const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const config = require('../config/config');

class PixVerseService {
  constructor() {
    this.apiKey = config.pixverse.apiKey;
    this.baseUrl = config.pixverse.baseUrl;
  }

  getHeaders(customHeaders = {}) {
    if (!this.apiKey) {
      throw new Error('PIXVERSE_KEY_MISSING: La clé PIXVERSE_API_KEY n\'est pas configurée.');
    }
    return {
      'API-KEY': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
      ...customHeaders
    };
  }

  async generateTextToVideo(prompt, duration = 5, aspectRatio = '16:9') {
    try {
      const response = await axios.post(
        `${this.baseUrl}/video/text/generate`,
        {
          prompt: prompt,
          duration: parseInt(duration, 10),
          aspect_ratio: aspectRatio,
          model: 'v3.5'
        },
        { headers: this.getHeaders({ 'Content-Type': 'application/json' }) }
      );

      const data = response.data;
      if (data && (data.task_id || data.id || (data.data && data.data.task_id))) {
        return data.task_id || data.id || data.data.task_id;
      }
      throw new Error('Reponse PixVerse invalide lors de la création de la tâche Text-to-Video.');
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async generateImageToVideo(imagePath, prompt, duration = 5, aspectRatio = '16:9') {
    try {
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));
      formData.append('prompt', prompt);
      formData.append('duration', parseInt(duration, 10));
      formData.append('aspect_ratio', aspectRatio);
      formData.append('model', 'v3.5');

      const response = await axios.post(
        `${this.baseUrl}/video/image/generate`,
        formData,
        {
          headers: this.getHeaders(formData.getHeaders())
        }
      );

      const data = response.data;
      if (data && (data.task_id || data.id || (data.data && data.data.task_id))) {
        return data.task_id || data.id || data.data.task_id;
      }
      throw new Error('Réponse PixVerse invalide lors de la création de la tâche Image-to-Video.');
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async getTaskStatus(taskId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/video/status/${taskId}`,
        { headers: this.getHeaders() }
      );

      const rawData = response.data.data || response.data;
      
      let status = 'processing';
      const rawStatus = (rawData.status || '').toLowerCase();

      if (['completed', 'success', 'succeeded', 'finish'].includes(rawStatus)) {
        status = 'completed';
      } else if (['failed', 'error'].includes(rawStatus)) {
        status = 'failed';
      } else if (['cancelled', 'canceled'].includes(rawStatus)) {
        status = 'cancelled';
      } else if (['expired'].includes(rawStatus)) {
        status = 'expired';
      }

      return {
        taskId: taskId,
        status: status,
        progress: rawData.progress || (status === 'completed' ? 100 : 50),
        videoUrl: rawData.video_url || rawData.url || rawData.result || null
      };
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  handleAxiosError(error) {
    if (error.response) {
      const status = error.response.status;
      const msg = error.response.data?.message || error.response.data?.error || 'Erreur API PixVerse';
      if (status === 401 || status === 403) {
        throw new Error('PIXVERSE_AUTH_ERROR: Clé API PixVerse invalide ou non autorisée.');
      }
      throw new Error(`PIXVERSE_API_ERROR: (${status}) ${msg}`);
    } else if (error.request) {
      throw new Error('PIXVERSE_TIMEOUT: Le serveur PixVerse ne répond pas.');
    } else {
      throw error;
    }
  }
}

module.exports = new PixVerseService();
