let selectedFile = null;
let pollInterval = null;

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (tab === 'text') {
    document.getElementById('tab-text-btn').classList.add('active');
    document.getElementById('text-form').classList.remove('hidden');
    document.getElementById('image-form').classList.add('hidden');
  } else {
    document.getElementById('tab-image-btn').classList.add('active');
    document.getElementById('image-form').classList.remove('hidden');
    document.getElementById('text-form').classList.add('hidden');
  }
}

// DRAG & DROP LOGIC
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('image-file');

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = '#6366f1';
});

dropZone.addEventListener('dragleave', () => {
  dropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
  if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
});

function handleFile(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    alert('Format non supporté (Utilisez JPG, PNG ou WEBP).');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    alert('Image trop volumineuse (Max 10 Mo).');
    return;
  }

  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('image-preview').src = e.target.result;
    document.getElementById('drop-zone-prompt').classList.add('hidden');
    document.getElementById('preview-container').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  selectedFile = null;
  fileInput.value = '';
  document.getElementById('preview-container').classList.add('hidden');
  document.getElementById('drop-zone-prompt').classList.remove('hidden');
}

// FORM SUBMISSIONS
document.getElementById('text-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = document.getElementById('text-prompt').value;
  const duration = document.getElementById('text-duration').value;
  const aspect_ratio = document.getElementById('text-aspect').value;

  startGeneration('/api/video/text', { prompt, duration, aspect_ratio }, false);
});

document.getElementById('image-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedFile) {
    alert('Veuillez sélectionner une image.');
    return;
  }
  const prompt = document.getElementById('image-prompt').value;
  const duration = document.getElementById('image-duration').value;
  const aspect_ratio = document.getElementById('image-aspect').value;

  const formData = new FormData();
  formData.append('image', selectedFile);
  formData.append('prompt', prompt);
  formData.append('duration', duration);
  formData.append('aspect_ratio', aspect_ratio);

  startGeneration('/api/video/image', formData, true);
});

async function startGeneration(endpoint, payload, isFormData) {
  const statusCard = document.getElementById('status-card');
  const progressBar = document.getElementById('progress-bar');
  const statusMessage = document.getElementById('status-message');
  const statusBadge = document.getElementById('status-badge');
  const resultContainer = document.getElementById('result-container');

  statusCard.classList.remove('hidden');
  resultContainer.classList.add('hidden');
  progressBar.style.width = '10%';
  statusBadge.innerText = 'Envoi...';
  statusMessage.innerText = 'Création de la tâche auprès de PixVerse...';

  try {
    const options = {
      method: 'POST',
      body: isFormData ? payload : JSON.stringify(payload)
    };
    if (!isFormData) {
      options.headers = { 'Content-Type': 'application/json' };
    }

    const response = await fetch(endpoint, options);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error?.message || 'Erreur lors de la soumission.');
    }

    document.getElementById('task-id-display').innerText = `ID: ${data.task_id}`;
    pollTaskStatus(data.task_id);

  } catch (err) {
    statusBadge.innerText = 'Erreur';
    statusMessage.innerText = err.message;
    progressBar.style.width = '0%';
  }
}

function pollTaskStatus(taskId) {
  if (pollInterval) clearInterval(pollInterval);

  const startTime = Date.now();
  const maxTimeout = 10 * 60 * 1000; // 10 minutes timeout

  pollInterval = setInterval(async () => {
    if (Date.now() - startTime > maxTimeout) {
      clearInterval(pollInterval);
      document.getElementById('status-badge').innerText = 'Timeout';
      document.getElementById('status-message').innerText = 'Délai d\'attente dépassé (10 min).';
      return;
    }

    try {
      const res = await fetch(`/api/video/status/${taskId}`);
      const data = await res.json();

      if (!data.success) {
        clearInterval(pollInterval);
        document.getElementById('status-badge').innerText = 'Erreur';
        document.getElementById('status-message').innerText = data.error?.message || 'Erreur lors du suivi.';
        return;
      }

      const status = data.status;
      const progress = data.progress || 50;
      document.getElementById('progress-bar').style.width = `${progress}%`;

      if (status === 'processing') {
        document.getElementById('status-badge').innerText = 'Génération...';
        document.getElementById('status-message').innerText = `Rendu en cours (${progress}%)...`;
      } else if (status === 'completed') {
        clearInterval(pollInterval);
        document.getElementById('progress-bar').style.width = '100%';
        document.getElementById('status-badge').innerText = 'Terminé';
        document.getElementById('status-message').innerText = 'Vidéo générée avec succès !';

        document.getElementById('video-player').src = data.video_url;
        document.getElementById('download-btn').href = data.video_url;
        document.getElementById('result-container').classList.remove('hidden');
      } else {
        clearInterval(pollInterval);
        document.getElementById('status-badge').innerText = status.toUpperCase();
        document.getElementById('status-message').innerText = `Échec de la tâche avec le statut : ${status}`;
      }

    } catch (e) {
      console.error('Polling error:', e);
    }
  }, 5000);
                               }
