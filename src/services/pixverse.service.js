const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const { crypto } = require('crypto');
const config = require('../config/config');

class PixVerseService {
  constructor() {
    this.apiKey = config.pixverse.apiKey;
    // URL officielle de la plateforme PixVerse Open API
    this.baseUrl = 'https://app-api.pixverse.ai/openapi/v2';
  }

  getHeaders(customHeaders = {}) {
    if (!this.apiKey) {
      throw new Error('PIXVERSE_KEY_MISSING: La clé PIXVERSE_API_KEY n\'est pas configurée dans Render.');
    }
    return {
      'API-KEY': this.apiKey,
      // Trace ID unique requis par PixVerse pour éviter le cache / timeout
      'Ai-trace-id': `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
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
        { 
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          timeout: 15000 // 15s max pour créer la tâche
        }
      );

      const data = response.data;
      if (data && (data.ErrCode === 0 || data.task_id || data.Resp?.video_id)) {
        return data.task_id || data.Resp?.video_id || data.data?.task_id;
      }
      throw new Error(data.ErrMsg || 'Échec lors de la création de la tâche PixVerse.');
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
        `${this.baseUrl}/video/img/generate`,
        formData,
        {
          headers: this.getHeaders(formData.getHeaders()),
          timeout: 20000
        }
      );

      const data = response.data;
      if (data && (data.ErrCode === 0 || data.task_id || data.Resp?.video_id)) {
        return data.task_id || data.Resp?.video_id || data.data?.task_id;
      }
      throw new Error(data.ErrMsg || 'Échec lors de l\'envoi de l\'image.');
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async getTaskStatus(taskId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/video/result/${taskId}`,
        { 
          headers: this.getHeaders(),
          timeout: 10000 
        }
      );

      const resData = response.data;
      const rawData = resData.Resp || resData.data || resData;
      
      let status = 'processing';
      const statusCode = rawData.status; // PixVerse utilise les codes : 1 = Terminé, 5 = En cours, 8 = Échec

      if (statusCode === 1 || rawData.status === 'success' || rawData.url) {
        status = 'completed';
      } else if (statusCode === 8 || rawData.status === 'failed') {
        status = 'failed';
      }

      return {
        taskId: taskId,
        status: status,
        progress: status === 'completed' ? 100 : 50,
        videoUrl: rawData.url || rawData.video_url || null
      };
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  handleAxiosError(error) {
    if (error.response) {
      const status = error.response.status;
      const msg = error.response.data?.ErrMsg || error.response.data?.message || 'Erreur API PixVerse';
      if (status === 401 || status === 403) {
        throw new Error('PIXVERSE_AUTH_ERROR: Clé API PixVerse invalide ou crédits insuffisants.');
      }
      throw new Error(`PIXVERSE_API_ERROR: (${status}) ${msg}`);
    } else if (error.code === 'ECONNABORTED' || error.request) {
      throw new Error('PIXVERSE_TIMEOUT: Impossible de joindre le serveur PixVerse. Vérifiez votre clé API ou réessayez.');
    } else {
      throw error;
    }
  }
}

module.exports = new PixVerseService();
