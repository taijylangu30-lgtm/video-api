const pixverseService = require('../services/pixverse.service');
const { deleteFile, formatError } = require('../utils/helpers');

exports.textToVideo = async (req, res) => {
  try {
    const { prompt, duration, aspect_ratio } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json(formatError('INVALID_PROMPT', 'Le champ "prompt" est obligatoire.'));
    }

    const taskId = await pixverseService.generateTextToVideo(
      prompt.trim(),
      duration || 5,
      aspect_ratio || '16:9'
    );

    return res.status(200).json({
      success: true,
      task_id: taskId,
      status: 'processing'
    });
  } catch (error) {
    return res.status(500).json(formatError('PIXVERSE_ERROR', error.message));
  }
};

exports.imageToVideo = async (req, res) => {
  const file = req.file;
  try {
    const { prompt, duration, aspect_ratio } = req.body;

    if (!file) {
      return res.status(400).json(formatError('MISSING_IMAGE', 'Aucune image n\'a été fournie.'));
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      deleteFile(file.path);
      return res.status(400).json(formatError('INVALID_PROMPT', 'Le champ "prompt" est obligatoire.'));
    }

    const taskId = await pixverseService.generateImageToVideo(
      file.path,
      prompt.trim(),
      duration || 5,
      aspect_ratio || '16:9'
    );

    deleteFile(file.path);

    return res.status(200).json({
      success: true,
      task_id: taskId,
      status: 'processing'
    });
  } catch (error) {
    if (file) deleteFile(file.path);
    return res.status(500).json(formatError('PIXVERSE_ERROR', error.message));
  }
};

exports.getStatus = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json(formatError('INVALID_TASK_ID', 'L\'identifiant de tâche est requis.'));
    }

    const taskData = await pixverseService.getTaskStatus(taskId);

    return res.status(200).json({
      success: true,
      task_id: taskData.taskId,
      status: taskData.status,
      progress: taskData.progress,
      video_url: taskData.videoUrl
    });
  } catch (error) {
    return res.status(500).json(formatError('PIXVERSE_ERROR', error.message));
  }
};
