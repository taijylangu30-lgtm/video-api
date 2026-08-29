"use strict";

const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const crypto = require("crypto");
const config = require("../config/config");

class PixVerseService {
  constructor() {
    this.apiKey = config?.pixverse?.apiKey;

    // API PixVerse officielle actuelle
    this.baseUrl = "https://app-api.pixverse.ai/openapi/v2";

    // Paramètres par défaut
    this.defaultModel = "v6";
    this.defaultDuration = 5;
    this.defaultQuality = "540p";
    this.defaultMotionMode = "normal";

    // Statuts PixVerse
    this.STATUS = {
      COMPLETED: 1,
      PROCESSING: 5,
      MODERATION_FAILED: 7,
      FAILED: 8,
      DELETED: 6
    };
  }

  /**
   * Vérifie que la clé API existe
   */
  checkApiKey() {
    if (!this.apiKey) {
      throw new Error(
        "PIXVERSE_KEY_MISSING: PIXVERSE_API_KEY n'est pas configurée."
      );
    }
  }

  /**
   * Génère un Ai-trace-id unique.
   *
   * PixVerse demande un UUID différent pour chaque requête.
   */
  createTraceId() {
    return crypto.randomUUID();
  }

  /**
   * Headers PixVerse
   */
  getHeaders(customHeaders = {}) {
    this.checkApiKey();

    return {
      "API-KEY": this.apiKey,
      "Ai-trace-id": this.createTraceId(),
      ...customHeaders
    };
  }

  /**
   * Vérifie la réponse PixVerse
   */
  checkPixVerseResponse(data) {
    if (!data) {
      throw new Error(
        "PIXVERSE_EMPTY_RESPONSE: Réponse vide reçue de PixVerse."
      );
    }

    if (data.ErrCode !== undefined && Number(data.ErrCode) !== 0) {
      throw new Error(
        `PIXVERSE_API_ERROR: ${data.ErrMsg || "Erreur PixVerse inconnue"}`
      );
    }

    return data;
  }

  /**
   * Convertit un ratio utilisateur vers un ratio accepté.
   */
  normalizeAspectRatio(aspectRatio) {
    const allowed = [
      "16:9",
      "9:16",
      "1:1",
      "4:3",
      "3:4"
    ];

    if (!aspectRatio) {
      return "16:9";
    }

    const ratio = String(aspectRatio).trim();

    return allowed.includes(ratio) ? ratio : "16:9";
  }

  /**
   * Normalise la durée.
   *
   * PixVerse supporte notamment 5 secondes.
   * On conserve 8 si ton compte/modèle l'accepte.
   */
  normalizeDuration(duration) {
    const value = parseInt(duration, 10);

    if (![5, 8].includes(value)) {
      return this.defaultDuration;
    }

    return value;
  }

  /**
   * Normalise la qualité.
   */
  normalizeQuality(quality) {
    const allowed = [
      "360p",
      "540p",
      "720p",
      "1080p"
    ];

    if (!quality) {
      return this.defaultQuality;
    }

    const value = String(quality).toLowerCase();

    return allowed.includes(value)
      ? value
      : this.defaultQuality;
  }

  /**
   * TEXT → VIDEO
   *
   * POST /video/text/generate
   */
  async generateTextToVideo(
    prompt,
    duration = 5,
    aspectRatio = "16:9",
    options = {}
  ) {
    try {
      this.checkApiKey();

      if (!prompt || !String(prompt).trim()) {
        throw new Error(
          "INVALID_PROMPT: Le prompt est obligatoire."
        );
      }

      const cleanPrompt = String(prompt).trim();

      if (cleanPrompt.length > 2048) {
        throw new Error(
          "INVALID_PROMPT: Le prompt ne doit pas dépasser 2048 caractères."
        );
      }

      const body = {
        prompt: cleanPrompt,
        model: options.model || this.defaultModel,
        duration: this.normalizeDuration(duration),
        aspect_ratio: this.normalizeAspectRatio(aspectRatio),
        quality: this.normalizeQuality(
          options.quality || this.defaultQuality
        ),
        motion_mode:
          options.motion_mode || this.defaultMotionMode
      };

      if (options.negative_prompt) {
        body.negative_prompt = String(options.negative_prompt);
      }

      if (options.seed !== undefined) {
        body.seed = Number(options.seed);
      }

      if (options.water_mark !== undefined) {
        body.water_mark = Boolean(options.water_mark);
      }

      const response = await axios.post(
        `${this.baseUrl}/video/text/generate`,
        body,
        {
          headers: this.getHeaders({
            "Content-Type": "application/json"
          }),
          timeout: 30000,
          validateStatus: () => true
        }
      );

      const data = this.checkHttpResponse(response);

      this.checkPixVerseResponse(data);

      const videoId =
        data?.Resp?.video_id ??
        data?.data?.video_id ??
        data?.video_id;

      if (!videoId) {
        throw new Error(
          "PIXVERSE_INVALID_RESPONSE: Aucun video_id retourné par PixVerse."
        );
      }

      return {
        success: true,
        videoId: String(videoId),
        taskId: String(videoId),
        status: "processing",
        raw: data
      };
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  /**
   * Upload d'une image vers PixVerse.
   *
   * POST /image/upload
   *
   * Retourne img_id.
   */
  async uploadImage(imagePath) {
    try {
      this.checkApiKey();

      if (!imagePath) {
        throw new Error(
          "IMAGE_MISSING: Le chemin de l'image est obligatoire."
        );
      }

      if (!fs.existsSync(imagePath)) {
        throw new Error(
          "IMAGE_NOT_FOUND: Le fichier image n'existe pas."
        );
      }

      const formData = new FormData();

      formData.append(
        "image",
        fs.createReadStream(imagePath)
      );

      const response = await axios.post(
        `${this.baseUrl}/image/upload`,
        formData,
        {
          headers: this.getHeaders(
            formData.getHeaders()
          ),
          timeout: 60000,
          maxContentLength: 25 * 1024 * 1024,
          maxBodyLength: 25 * 1024 * 1024,
          validateStatus: () => true
        }
      );

      const data = this.checkHttpResponse(response);

      this.checkPixVerseResponse(data);

      const imgId =
        data?.Resp?.img_id ??
        data?.data?.img_id ??
        data?.img_id;

      if (!imgId) {
        throw new Error(
          "PIXVERSE_IMAGE_UPLOAD_ERROR: Aucun img_id retourné."
        );
      }

      return {
        success: true,
        imgId: String(imgId),
        imageUrl:
          data?.Resp?.img_url ??
          data?.data?.img_url ??
          null,
        raw: data
      };
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  /**
   * IMAGE → VIDEO
   *
   * Étape 1 :
   * upload image → img_id
   *
   * Étape 2 :
   * img_id + prompt → video_id
   */
  async generateImageToVideo(
    imagePath,
    prompt,
    duration = 5,
    aspectRatio = "16:9",
    options = {}
  ) {
    try {
      this.checkApiKey();

      if (!imagePath) {
        throw new Error(
          "IMAGE_MISSING: Aucune image fournie."
        );
      }

      if (!prompt || !String(prompt).trim()) {
        throw new Error(
          "INVALID_PROMPT: Le prompt est obligatoire."
        );
      }

      // ==============================
      // 1. UPLOAD DE L'IMAGE
      // ==============================

      const uploadResult = await this.uploadImage(
        imagePath
      );

      const imgId = uploadResult.imgId;

      // ==============================
      // 2. GÉNÉRATION IMAGE → VIDEO
      // ==============================

      const body = {
        img_id: Number(imgId),
        prompt: String(prompt).trim(),
        model: options.model || this.defaultModel,
        duration: this.normalizeDuration(duration),
        quality: this.normalizeQuality(
          options.quality || this.defaultQuality
        ),
        motion_mode:
          options.motion_mode || this.defaultMotionMode
      };

      /**
       * PixVerse accepte également certains paramètres
       * optionnels selon le modèle/fonction utilisée.
       */
      if (aspectRatio) {
        body.aspect_ratio =
          this.normalizeAspectRatio(aspectRatio);
      }

      if (options.negative_prompt) {
        body.negative_prompt = String(
          options.negative_prompt
        );
      }

      if (options.seed !== undefined) {
        body.seed = Number(options.seed);
      }

      if (options.camera_movement) {
        body.camera_movement =
          String(options.camera_movement);
      }

      if (options.template_id !== undefined) {
        body.template_id =
          Number(options.template_id);
      }

      if (options.sound_effect_switch !== undefined) {
        body.sound_effect_switch =
          Boolean(options.sound_effect_switch);
      }

      if (options.sound_effect_content) {
        body.sound_effect_content =
          String(options.sound_effect_content);
      }

      const response = await axios.post(
        `${this.baseUrl}/video/img/generate`,
        body,
        {
          headers: this.getHeaders({
            "Content-Type": "application/json"
          }),
          timeout: 30000,
          validateStatus: () => true
        }
      );

      const data = this.checkHttpResponse(response);

      this.checkPixVerseResponse(data);

      const videoId =
        data?.Resp?.video_id ??
        data?.data?.video_id ??
        data?.video_id;

      if (!videoId) {
        throw new Error(
          "PIXVERSE_INVALID_RESPONSE: Aucun video_id retourné après Image-to-Video."
        );
      }

      return {
        success: true,
        videoId: String(videoId),
        taskId: String(videoId),
        imgId: String(imgId),
        status: "processing",
        raw: data
      };
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  /**
   * Récupère le statut d'une génération.
   *
   * GET /video/result/{video_id}
   */
  async getTaskStatus(videoId) {
    try {
      this.checkApiKey();

      if (!videoId) {
        throw new Error(
          "VIDEO_ID_MISSING: video_id obligatoire."
        );
      }

      const response = await axios.get(
        `${this.baseUrl}/video/result/${encodeURIComponent(
          videoId
        )}`,
        {
          headers: this.getHeaders(),
          timeout: 15000,
          validateStatus: () => true
        }
      );

      const data = this.checkHttpResponse(response);

      this.checkPixVerseResponse(data);

      const result =
        data?.Resp ??
        data?.data ??
        data;

      const numericStatus =
        Number(result?.status);

      let status = "processing";

      switch (numericStatus) {
        case this.STATUS.COMPLETED:
          status = "completed";
          break;

        case this.STATUS.PROCESSING:
          status = "processing";
          break;

        case this.STATUS.MODERATION_FAILED:
          status = "moderation_failed";
          break;

        case this.STATUS.FAILED:
          status = "failed";
          break;

        case this.STATUS.DELETED:
          status = "deleted";
          break;

        default:
          status = "processing";
      }

      return {
        success: true,
        videoId: String(
          result?.id ?? videoId
        ),
        taskId: String(videoId),
        status,
        pixverseStatus: numericStatus,
        progress:
          status === "completed"
            ? 100
            : status === "processing"
              ? 50
              : 0,
        videoUrl:
          result?.url ||
          result?.video_url ||
          null,
        prompt:
          result?.prompt || null,
        width:
          result?.outputWidth ??
          result?.output_width ??
          null,
        height:
          result?.outputHeight ??
          result?.output_height ??
          null,
        raw: data
      };
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  /**
   * Attend automatiquement la fin d'une génération.
   *
   * PixVerse recommande un polling de quelques secondes.
   */
  async waitForCompletion(
    videoId,
    options = {}
  ) {
    const interval =
      Number(options.interval) || 5000;

    const timeout =
      Number(options.timeout) || 10 * 60 * 1000;

    const start = Date.now();

    while (Date.now() - start < timeout) {
      const result =
        await this.getTaskStatus(videoId);

      if (result.status === "completed") {
        return result;
      }

      if (
        result.status === "failed" ||
        result.status === "moderation_failed" ||
        result.status === "deleted"
      ) {
        throw new Error(
          `PIXVERSE_GENERATION_FAILED: ${result.status}`
        );
      }

      await this.sleep(interval);
    }

    throw new Error(
      "PIXVERSE_TIMEOUT: La génération PixVerse a dépassé le délai maximal."
    );
  }

  /**
   * Génération Text → Video + attente du résultat.
   */
  async generateTextToVideoAndWait(
    prompt,
    duration = 5,
    aspectRatio = "16:9",
    options = {}
  ) {
    const task =
      await this.generateTextToVideo(
        prompt,
        duration,
        aspectRatio,
        options
      );

    return await this.waitForCompletion(
      task.videoId,
      {
        interval:
          options.pollInterval || 5000,
        timeout:
          options.timeout || 10 * 60 * 1000
      }
    );
  }

  /**
   * Génération Image → Video + attente du résultat.
   */
  async generateImageToVideoAndWait(
    imagePath,
    prompt,
    duration = 5,
    aspectRatio = "16:9",
    options = {}
  ) {
    const task =
      await this.generateImageToVideo(
        imagePath,
        prompt,
        duration,
        aspectRatio,
        options
      );

    return await this.waitForCompletion(
      task.videoId,
      {
        interval:
          options.pollInterval || 5000,
        timeout:
          options.timeout || 10 * 60 * 1000
      }
    );
  }

  /**
   * Vérification HTTP avant analyse PixVerse.
   */
  checkHttpResponse(response) {
    if (!response) {
      throw new Error(
        "PIXVERSE_EMPTY_RESPONSE: Aucune réponse HTTP."
      );
    }

    if (
      response.status < 200 ||
      response.status >= 300
    ) {
      const data = response.data || {};

      const message =
        data?.ErrMsg ||
        data?.message ||
        data?.error ||
        `HTTP ${response.status}`;

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        throw new Error(
          "PIXVERSE_AUTH_ERROR: Clé API PixVerse invalide, expirée ou non autorisée."
        );
      }

      throw new Error(
        `PIXVERSE_API_ERROR: (${response.status}) ${message}`
      );
    }

    return response.data;
  }

  /**
   * Gestion centralisée des erreurs Axios.
   */
  handleAxiosError(error) {
    if (
      error?.message &&
      (
        error.message.startsWith("PIXVERSE_") ||
        error.message.startsWith("INVALID_") ||
        error.message.startsWith("IMAGE_") ||
        error.message.startsWith("VIDEO_")
      )
    ) {
      throw error;
    }

    if (error?.response) {
      const status =
        error.response.status;

      const data =
        error.response.data || {};

      const message =
        data?.ErrMsg ||
        data?.message ||
        data?.error ||
        "Erreur inconnue de PixVerse.";

      if (
        status === 401 ||
        status === 403
      ) {
        throw new Error(
          "PIXVERSE_AUTH_ERROR: Clé API PixVerse invalide ou non autorisée."
        );
      }

      if (status === 429) {
        throw new Error(
          "PIXVERSE_RATE_LIMIT: Trop de requêtes. Réessaie plus tard."
        );
      }

      throw new Error(
        `PIXVERSE_API_ERROR: (${status}) ${message}`
      );
    }

    if (
      error?.code === "ECONNABORTED" ||
      error?.code === "ETIMEDOUT" ||
      String(error?.message)
        .toLowerCase()
        .includes("timeout")
    ) {
      throw new Error(
        "PIXVERSE_TIMEOUT: Le serveur PixVerse n'a pas répondu à temps."
      );
    }

    if (
      error?.code === "ENOTFOUND"
    ) {
      throw new Error(
        "PIXVERSE_NETWORK_ERROR: Impossible de résoudre le domaine PixVerse. Vérifie la connexion réseau et l'URL API."
      );
    }

    throw error;
  }

  /**
   * Petite fonction sleep.
   */
  sleep(ms) {
    return new Promise(
      resolve => setTimeout(resolve, ms)
    );
  }
}

module.exports = new PixVerseService();
