document.addEventListener('DOMContentLoaded', function() {
  const wholePage = document.getElementById('whole-page');
  const selectorMode = document.getElementById('selector-mode');
  const selectorInput = document.getElementById('selector-input');
  const selectorContainer = document.getElementById('selector-input-container');
  const startScrapeBtn = document.getElementById('start-scrape');
  const resultContainer = document.getElementById('result-container');
  const resultPreview = document.getElementById('result-preview');
  const exportCsvBtn = document.getElementById('export-csv');
  const exportJsonBtn = document.getElementById('export-json');
  const loadingElement = document.getElementById('loading');
  
  let currentMode = 'whole-page';
  let scrapeResult = null;

  wholePage.addEventListener('click', function() {
    currentMode = 'whole-page';
    wholePage.classList.add('active');
    selectorMode.classList.remove('active');
    selectorContainer.style.display = 'none';
  });

  selectorMode.addEventListener('click', function() {
    currentMode = 'selector';
    selectorMode.classList.add('active');
    wholePage.classList.remove('active');
    selectorContainer.style.display = 'block';
  });

  startScrapeBtn.addEventListener('click', function() {
    resultContainer.style.display = 'none';
    loadingElement.style.display = 'block';
    
    const config = {
      mode: currentMode,
      selector: selectorInput.value.trim()
    };

    chrome.storage.local.set({ 'scrapeConfig': config }, function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          files: ['content.js']
        });
      });
    });
  });

  exportCsvBtn.addEventListener('click', function() {
    if (scrapeResult) {
      downloadCSV(scrapeResult);
    }
  });

  exportJsonBtn.addEventListener('click', function() {
    if (scrapeResult) {
      downloadJSON(scrapeResult);
    }
  });

  // 监听来自content.js的消息
  chrome.runtime.onMessage.addListener(function(message) {
    if (message.type === 'scrapeResult') {
      loadingElement.style.display = 'none';
      resultContainer.style.display = 'block';
      scrapeResult = message.data;
      
      // 显示预览
      resultPreview.textContent = JSON.stringify(scrapeResult, null, 2);
    }
  });

  function downloadCSV(data) {
    let csv = '';
    
    if (Array.isArray(data)) {
      // 获取所有可能的键
      const keys = new Set();
      data.forEach(item => {
        Object.keys(item).forEach(key => keys.add(key));
      });
      const headers = Array.from(keys);
      
      // 添加表头
      csv += headers.join(',') + '\n';
      
      // 添加数据行
      data.forEach(item => {
        const row = headers.map(header => {
          const value = item[header] || '';
          return `"${value.toString().replace(/"/g, '""')}"`;
        });
        csv += row.join(',') + '\n';
      });
    } else {
      // 对象类型数据
      for (const [key, value] of Object.entries(data)) {
        csv += `"${key}","${value.toString().replace(/"/g, '""')}"\n`;
      }
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `scraped_data_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadJSON(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `scraped_data_${new Date().getTime()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 默认选中整页模式
  wholePage.classList.add('active');
}); 