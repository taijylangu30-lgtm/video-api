const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const config = require('../config/config');

class PixVerseService {
  constructor() {
    this.apiKey = config.pixverse.apiKey;
    // 💡 URL de la passerelle OpenAPI officielle Platform PixVerse
    this.baseUrl = 'https://api.pixverse.ai';
  }

  getHeaders(customHeaders = {}) {
    if (!this.apiKey) {
      throw new Error('PIXVERSE_KEY_MISSING: La clé PIXVERSE_API_KEY n\'est pas configurée.');
    }
    return {
      'API-KEY': this.apiKey,
      ...customHeaders
    };
  }

  async generateTextToVideo(prompt, duration = 5, aspectRatio = '16:9') {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v2/video/text/generate`,
        {
          prompt: prompt,
          duration: parseInt(duration, 10),
          aspect_ratio: aspectRatio,
          model: 'v3.5',
          quality: '540p'
        },
        { 
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          timeout: 30000 
        }
      );

      const resData = response.data;
      
      // Extraction de l'ID selon la structure retournée par OpenAPI
      const videoId = resData?.data?.task_id || resData?.data?.video_id || resData?.task_id || resData?.video_id || resData?.Resp?.video_id;

      if (videoId) {
        return String(videoId);
      }

      throw new Error(resData?.message || resData?.ErrMsg || 'Réponse PixVerse invalide.');
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
        `${this.baseUrl}/v2/video/image/generate`,
        formData,
        {
          headers: this.getHeaders(formData.getHeaders()),
          timeout: 45000
        }
      );

      const resData = response.data;
      const videoId = resData?.data?.task_id || resData?.data?.video_id || resData?.task_id || resData?.video_id || resData?.Resp?.video_id;

      if (videoId) {
        return String(videoId);
      }

      throw new Error(resData?.message || resData?.ErrMsg || 'Réponse PixVerse invalide.');
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async getTaskStatus(taskId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v2/video/result/${taskId}`,
        { 
          headers: this.getHeaders(),
          timeout: 15000 
        }
      );

      const rawData = response.data?.data || response.data?.Resp || response.data;
      
      let status = 'processing';
      const rawStatus = String(rawData?.status || rawData?.state || '').toLowerCase();

      if (['completed', 'success', 'succeeded', '1', 'finish'].includes(rawStatus)) {
        status = 'completed';
      } else if (['failed', 'error', '2'].includes(rawStatus)) {
        status = 'failed';
      }

      return {
        taskId: taskId,
        status: status,
        progress: status === 'completed' ? 100 : (rawData?.progress || 50),
        videoUrl: rawData?.url || rawData?.video_url || rawData?.result || null
      };
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  handleAxiosError(error) {
    if (error.response) {
      const status = error.response.status;
      const msg = error.response.data?.message || error.response.data?.ErrMsg || 'Erreur API PixVerse';
      if (status === 401 || status === 403) {
        throw new Error('PIXVERSE_AUTH_ERROR: Clé API invalide ou crédits insuffisants sur platform.pixverse.ai.');
      }
      throw new Error(`PIXVERSE_API_ERROR: (${status}) ${msg}`);
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('PIXVERSE_TIMEOUT: Le serveur PixVerse ne répond pas dans le délai imparti.');
    } else {
      throw error;
    }
  }
}

module.exports = new PixVerseService();
