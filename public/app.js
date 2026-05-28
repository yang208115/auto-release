// UI Elements
const els = {
  generateForm: document.getElementById('generateForm'),
  settingsForm: document.getElementById('settingsForm'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  generateBtn: document.getElementById('generateBtn'),
  markdownOutput: document.getElementById('markdownOutput'),
  copyBtn: document.getElementById('copyBtn'),
  statsLabel: document.getElementById('statsLabel'),
  toast: document.getElementById('toast'),

  // Inputs
  repoInput: document.getElementById('repoInput'),
  tagInput: document.getElementById('tagInput'),
  aiProvider: document.getElementById('aiProvider'),
  githubToken: document.getElementById('githubToken'),
  openaiKey: document.getElementById('openaiKey'),
  anthropicKey: document.getElementById('anthropicKey'),
  aiBaseUrl: document.getElementById('aiBaseUrl'),
  aiModel: document.getElementById('aiModel'),
};

// Configuration Management
const CONFIG_KEY = 'releasegen_config';

function loadConfig() {
  const configStr = localStorage.getItem(CONFIG_KEY);
  if (configStr) {
    try {
      const config = JSON.parse(configStr);
      if (config.githubToken) els.githubToken.value = config.githubToken;
      if (config.openaiKey) els.openaiKey.value = config.openaiKey;
      if (config.anthropicKey) els.anthropicKey.value = config.anthropicKey;
      if (config.aiProvider) els.aiProvider.value = config.aiProvider;
      if (config.lastRepoInput) els.repoInput.value = config.lastRepoInput;
      if (config.aiBaseUrl) els.aiBaseUrl.value = config.aiBaseUrl;
      if (config.aiModel) els.aiModel.value = config.aiModel;
    } catch (e) {
      console.error('Failed to parse config');
    }
  }
}

function saveConfig() {
  const config = {
    githubToken: els.githubToken.value.trim(),
    openaiKey: els.openaiKey.value.trim(),
    anthropicKey: els.anthropicKey.value.trim(),
    aiProvider: els.aiProvider.value,
    lastRepoInput: els.repoInput.value.trim(),
    aiBaseUrl: els.aiBaseUrl.value.trim(),
    aiModel: els.aiModel.value.trim(),
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// Settings form submission
els.settingsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  saveConfig();
  showToast('设置已保存', 'bg-green-600');
});

// Toast functionality
let toastTimeout;
function showToast(message, bgColorClass = 'bg-zinc-800', duration = 3000) {
  els.toast.textContent = message;

  // Reset classes
  els.toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg text-white font-medium transition-opacity z-50 ${bgColorClass}`;
  els.toast.classList.remove('hidden');
  els.toast.style.opacity = '1';

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    els.toast.style.opacity = '0';
    setTimeout(() => els.toast.classList.add('hidden'), 300);
  }, duration);
}

// Copy to Clipboard
els.copyBtn.addEventListener('click', async () => {
  const text = els.markdownOutput.dataset.rawtext;
  if (!text) {
    showToast('无内容可复制', 'bg-red-600');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板！', 'bg-green-600');
  } catch (err) {
    showToast('复制失败', 'bg-red-600');
  }
});

// Main Generate Release Flow
els.generateForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const repoInputVal = els.repoInput.value.trim();
  const tag = els.tagInput.value.trim();
  const provider = els.aiProvider.value;

  const parts = repoInputVal.split('/');
  if (parts.length !== 2) {
    showToast('仓库地址格式应为 owner/repo', 'bg-red-600');
    return;
  }
  const owner = parts[0];
  const repo = parts[1];

  // Validate credentials
  const configStr = localStorage.getItem(CONFIG_KEY);
  let config = {};
  if (configStr) config = JSON.parse(configStr);

  if (provider === 'openai' && !config.openaiKey) {
    showToast('缺失 OpenAI API Key，请先在上方配置选项中保存。', 'bg-red-600');
    return;
  }
  if (provider === 'anthropic' && !config.anthropicKey) {
    showToast('缺失 Anthropic API Key，请先在上方配置选项中保存。', 'bg-red-600');
    return;
  }

  // Save current form usage state
  saveConfig();

  // Set UI state to loading
  const btnText = els.generateBtn.querySelector('.btn-text');

  els.generateBtn.disabled = true;
  btnText.textContent = '生成中...';

  try {
    const response = await fetch('/generate-release', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-token': config.githubToken || '',
        'x-openai-key': config.openaiKey || '',
        'x-anthropic-key': config.anthropicKey || '',
        'x-ai-base-url': config.aiBaseUrl || '',
        'x-ai-model': config.aiModel || ''
      },
      body: JSON.stringify({
        owner,
        repo,
        tag,
        aiProvider: provider
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${response.status}`);
    }

    const commitsAnalyzed = response.headers.get('X-Commits-Analyzed') || '0';
    els.statsLabel.textContent = `(分析了 ${commitsAnalyzed} 次提交)`;
    els.markdownOutput.dataset.rawtext = '';
    els.markdownOutput.innerHTML = '';

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let rawText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      rawText += chunk;
      els.markdownOutput.dataset.rawtext = rawText;

      if (typeof marked !== 'undefined') {
        els.markdownOutput.innerHTML = marked.parse(rawText);
      } else {
        els.markdownOutput.textContent = rawText;
      }
    }

    showToast('生成成功！', 'bg-green-600');

  } catch (err) {
    console.error(err);
    showToast(`错误: ${err.message}`, 'bg-red-600', 5000);
  } finally {
    els.generateBtn.disabled = false;
    btnText.textContent = '生成发布说明';
  }
});

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
});
