document.addEventListener('DOMContentLoaded', function() {
  const wholePage = document.getElementById('whole-page');
  const selectorMode = document.getElementById('selector-mode');
  const selectorControls = document.getElementById('selector-controls');
  const pickElementsBtn = document.getElementById('pick-elements');
  const selectedElements = document.getElementById('selected-elements');
  const selectedItemsList = document.getElementById('selected-items-list');
  const startScrapeBtn = document.getElementById('start-scrape');
  const resultContainer = document.getElementById('result-container');
  const resultPreview = document.getElementById('result-preview');
  const exportCsvBtn = document.getElementById('export-csv');
  const exportJsonBtn = document.getElementById('export-json');
  const loadingElement = document.getElementById('loading');
  
  let currentMode = 'whole-page';
  let scrapeResult = null;
  let selectedSelectors = [];
  let isPicking = false;

  // 在初始化时恢复状态
  chrome.storage.local.get(['scraperState'], function(result) {
    if (result.scraperState) {
      const state = result.scraperState;
      currentMode = state.mode || 'whole-page';
      selectedSelectors = state.selectors || [];
      isPicking = state.isPicking || false;

      // 恢复模式选择
      if (currentMode === 'selector') {
        selectorMode.classList.add('active');
        wholePage.classList.remove('active');
        selectorControls.style.display = 'block';
        selectedElements.style.display = 'block';
      } else {
        wholePage.classList.add('active');
        selectorMode.classList.remove('active');
        selectorControls.style.display = 'none';
        selectedElements.style.display = 'none';
      }

      // 恢复选择状态
      if (isPicking) {
        pickElementsBtn.textContent = 'Stop Picking';
        pickElementsBtn.classList.add('picking');
      }

      // 恢复已选择的元素列表
      if (selectedSelectors.length > 0) {
        updateSelectedElementsList(state.preview);
      }
    } else {
      wholePage.classList.add('active');
    }
  });

  // 保存状态的函数
  function saveState() {
    const state = {
      mode: currentMode,
      selectors: selectedSelectors,
      isPicking: isPicking,
      preview: scrapeResult
    };
    chrome.storage.local.set({ 'scraperState': state });
  }

  wholePage.addEventListener('click', function() {
    currentMode = 'whole-page';
    wholePage.classList.add('active');
    selectorMode.classList.remove('active');
    selectorControls.style.display = 'none';
    selectedElements.style.display = 'none';
    saveState();
  });

  selectorMode.addEventListener('click', function() {
    currentMode = 'selector';
    selectorMode.classList.add('active');
    wholePage.classList.remove('active');
    selectorControls.style.display = 'block';
    selectedElements.style.display = 'block';
    saveState();
  });

  pickElementsBtn.addEventListener('click', function() {
    isPicking = !isPicking;
    if (isPicking) {
      startPicking();
    } else {
      stopPicking();
    }
    saveState();
  });

  function startPicking() {
    pickElementsBtn.textContent = 'Stop Picking';
    pickElementsBtn.classList.add('picking');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        files: ['picker.js']
      }).then(() => {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'startPicking',
          selectors: selectedSelectors // 传递已选择的选择器
        });
      });
    });
  }

  function stopPicking() {
    pickElementsBtn.textContent = 'Pick Elements';
    pickElementsBtn.classList.remove('picking');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'stopPicking' });
    });
  }

  startScrapeBtn.addEventListener('click', function() {
    if (currentMode === 'selector' && selectedSelectors.length === 0) {
      alert('Please select at least one element first');
      return;
    }

    resultContainer.style.display = 'none';
    loadingElement.style.display = 'block';
    
    const config = {
      mode: currentMode,
      selectors: selectedSelectors
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

  // Listen for selected elements
  chrome.runtime.onMessage.addListener(function(message) {
    if (message.type === 'elementSelected' || message.type === 'pickingStopped') {
      // 更新选择器列表和预览
      selectedSelectors = message.selectors || [];
      updateSelectedElementsList(message.preview);
      
      // 如果是停止选择，更新按钮状态
      if (message.type === 'pickingStopped') {
        isPicking = false;
        pickElementsBtn.textContent = 'Pick Elements';
        pickElementsBtn.classList.remove('picking');
        
        // 显示选择的元素列表
        if (selectedSelectors.length > 0) {
          selectedElements.style.display = 'block';
          resultContainer.style.display = 'block';
          resultPreview.textContent = JSON.stringify(message.preview, null, 2);
        }
      }
      saveState();
    } else if (message.type === 'scrapeResult') {
      loadingElement.style.display = 'none';
      resultContainer.style.display = 'block';
      scrapeResult = message.data;
      resultPreview.textContent = JSON.stringify(scrapeResult, null, 2);
      saveState();
    }
  });

  function updateSelectedElementsList(preview) {
    selectedItemsList.innerHTML = '';
    if (selectedSelectors.length === 0) {
      selectedElements.style.display = 'none';
      resultContainer.style.display = 'none';
      return;
    }
    
    selectedSelectors.forEach((selector, index) => {
      const item = document.createElement('div');
      item.className = 'selected-item';
      
      // 获取预览数据
      const previewData = preview ? preview[index] : null;
      const previewText = previewData ? 
        previewData.preview.map(p => `${p.tag}: ${p.text}`).join('\n') : '';
      
      item.innerHTML = `
        <div class="selector-info">
          <span class="selector" title="${selector}">${truncateText(selector, 40)}</span>
          ${previewText ? `<div class="preview-text">${previewText}</div>` : ''}
        </div>
        <span class="remove" title="Remove">×</span>
      `;
      
      item.querySelector('.remove').addEventListener('click', () => {
        selectedSelectors = selectedSelectors.filter(s => s !== selector);
        updateSelectedElementsList(preview);
        
        if (selectedSelectors.length === 0) {
          selectedElements.style.display = 'none';
          resultContainer.style.display = 'none';
        }
      });
      
      selectedItemsList.appendChild(item);
    });
  }

  // 添加辅助函数来截断长文本
  function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  // 添加导出按钮事件监听
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

  // 添加导出功能的实现
  function downloadCSV(data) {
    let csv = '';
    let headers = new Set();
    
    // 处理数据结构，提取所有可能的标题
    if (Array.isArray(data)) {
      // 如果是选择器模式的数据
      data.forEach(item => {
        if (item.elements) {
          item.elements.forEach(element => {
            Object.keys(element).forEach(key => headers.add(key));
          });
        }
      });
      
      // 转换数据格式
      headers = Array.from(headers);
      csv = headers.join(',') + '\n';
      
      data.forEach(item => {
        if (item.elements) {
          item.elements.forEach(element => {
            const row = headers.map(header => {
              let value = element[header];
              if (typeof value === 'object') {
                value = JSON.stringify(value);
              }
              // 处理CSV中的特殊字符
              return `"${(value || '').toString().replace(/"/g, '""')}"`;
            });
            csv += row.join(',') + '\n';
          });
        }
      });
    } else {
      // 如果是整页模式的数据
      Object.keys(data).forEach(key => {
        let value = data[key];
        if (typeof value === 'object') {
          value = JSON.stringify(value);
        }
        csv += `"${key}","${(value || '').toString().replace(/"/g, '""')}"\n`;
      });
    }

    // 创建并下载文件
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `scraped_data_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function downloadJSON(data) {
    // 创建格式化的JSON字符串
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `scraped_data_${new Date().getTime()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  wholePage.classList.add('active');
}); 