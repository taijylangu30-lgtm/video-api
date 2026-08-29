const magicHourService = require('../services/magicHour.service');
const fs = require('fs');

exports.generateTextToVideo = async (req, res, next) => {
  try {
    const { prompt, duration, aspect_ratio } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Le prompt est requis.' }
      });
    }

    const taskId = await magicHourService.generateTextToVideo(prompt, duration, aspect_ratio);

    res.status(200).json({
      success: true,
      task_id: taskId,
      status: 'processing'
    });
  } catch (error) {
    next(error);
  }
};

exports.generateImageToVideo = async (req, res, next) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Une image est requise.' }
      });
    }

    filePath = req.file.path;
    const { prompt, duration, aspect_ratio } = req.body;

    const taskId = await magicHourService.generateImageToVideo(filePath, prompt, duration, aspect_ratio);

    // Supprimer le fichier temporaire local
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(200).json({
      success: true,
      task_id: taskId,
      status: 'processing'
    });
  } catch (error) {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    next(error);
  }
};

exports.getTaskStatus = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'taskId est requis.' }
      });
    }

    const statusResult = await magicHourService.getTaskStatus(taskId);

    res.status(200).json({
      success: true,
      task_id: statusResult.taskId,
      status: statusResult.status,
      progress: statusResult.progress,
      video_url: statusResult.videoUrl
    });
  } catch (error) {
    next(error);
  }
};
