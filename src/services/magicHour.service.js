const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class MagicHourService {
  constructor() {
    this.apiKey = config.magicHour?.apiKey || process.env.MAGIC_HOUR_API_KEY;
    this.baseUrl = 'https://api.magichour.ai/v1';
  }

  getHeaders(customHeaders = {}) {
    if (!this.apiKey) {
      throw new Error('MAGIC_HOUR_KEY_MISSING: La clé MAGIC_HOUR_API_KEY n\'est pas configurée.');
    }
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...customHeaders
    };
  }

  /**
   * Upload un fichier image vers le stockage sécurisé Magic Hour
   */
  async uploadAsset(filePath) {
    try {
      const ext = path.extname(filePath).replace('.', '').toLowerCase() || 'png';
      
      // Step 1: Obtenir la presigned upload URL
      const urlResponse = await axios.post(
        `${this.baseUrl}/files/upload-urls`,
        {
          items: [
            {
              extension: ext,
              type: 'image'
            }
          ]
        },
        { headers: this.getHeaders(), timeout: 15000 }
      );

      const uploadItem = urlResponse.data?.items?.[0];
      if (!uploadItem || !uploadItem.upload_url || !uploadItem.file_path) {
        throw new Error('MAGIC_HOUR_INVALID_RESPONSE: Échec de génération des URLs d\'upload.');
      }

      // Step 2: Upload du fichier via la presigned URL
      const fileData = fs.readFileSync(filePath);
      await axios.put(uploadItem.upload_url, fileData, {
        headers: {
          'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}`
        },
        timeout: 30000
      });

      return uploadItem.file_path;
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  /**
   * Génération Text-to-Video
   */
  async generateTextToVideo(prompt, duration = 5, aspectRatio = '16:9') {
    try {
      const payload = {
        name: `Text-to-Video ${Date.now()}`,
        end_seconds: parseFloat(duration),
        aspect_ratio: aspectRatio,
        style: {
          prompt: prompt
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/text-to-video`,
        payload,
        { headers: this.getHeaders(), timeout: 20000 }
      );

      const taskId = response.data?.id;
      if (!taskId) {
        throw new Error('MAGIC_HOUR_INVALID_RESPONSE: Tâche non créée.');
      }

      return taskId;
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  /**
   * Génération Image-to-Video
   */
  async generateImageToVideo(imagePath, prompt, duration = 5, aspectRatio = '16:9') {
    try {
      // 1. Upload de l'image
      const assetFilePath = await this.uploadAsset(imagePath);

      // 2. Création de la génération
      const payload = {
        name: `Image-to-Video ${Date.now()}`,
        end_seconds: parseFloat(duration),
        assets: {
          image_file_path: assetFilePath
        }
      };

      if (prompt && prompt.trim() !== '') {
        payload.style = { prompt: prompt };
      }

      const response = await axios.post(
        `${this.baseUrl}/image-to-video`,
        payload,
        { headers: this.getHeaders(), timeout: 20000 }
      );

      const taskId = response.data?.id;
      if (!taskId) {
        throw new Error('MAGIC_HOUR_INVALID_RESPONSE: Tâche non créée.');
      }

      return taskId;
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  /**
   * Vérification de l'état d'avancement
   */
  async getTaskStatus(taskId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/video-projects/${taskId}`,
        { headers: this.getHeaders(), timeout: 15000 }
      );

      const data = response.data;
      const rawStatus = (data?.status || '').toLowerCase();

      let status = 'processing';
      let progress = 50;

      if (['complete', 'completed', 'success'].includes(rawStatus)) {
        status = 'completed';
        progress = 100;
      } else if (['error', 'failed', 'canceled'].includes(rawStatus)) {
        status = 'failed';
        progress = 0;
      } else if (rawStatus === 'queued') {
        progress = 10;
      } else if (rawStatus === 'rendering') {
        progress = 60;
      }

      const videoUrl = data?.downloads?.[0]?.url || data?.download_url || null;

      return {
        taskId: taskId,
        status: status,
        progress: progress,
        videoUrl: videoUrl,
        error: data?.error || null
      };
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  /**
   * Mécanisme de Polling avec timeout
   */
  async waitForCompletion(taskId, intervalMs = 5000, timeoutMs = 300000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.getTaskStatus(taskId);

      if (result.status === 'completed') {
        return result;
      }

      if (result.status === 'failed') {
        throw new Error(`MAGIC_HOUR_GENERATION_FAILED: ${result.error || 'La génération a échoué.'}`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('MAGIC_HOUR_TIMEOUT: La génération de la vidéo a dépassé le délai imparti.');
  }

  /**
   * Gestion centralisée des erreurs API
   */
  handleAxiosError(error) {
    if (error.response) {
      const status = error.response.status;
      const msg = error.response.data?.message || error.response.data?.error || 'Erreur API Magic Hour';

      if (status === 401 || status === 403) {
        throw new Error('MAGIC_HOUR_AUTH_ERROR: Clé API Magic Hour invalide ou absente.');
      } else if (status === 429) {
        throw new Error('MAGIC_HOUR_RATE_LIMIT: Trop de requêtes ou crédits insuffisants.');
      }
      throw new Error(`MAGIC_HOUR_API_ERROR: (${status}) ${msg}`);
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('MAGIC_HOUR_TIMEOUT: Le serveur Magic Hour ne répond pas.');
    } else {
      throw error;
    }
  }
}

module.exports = new MagicHourService();
