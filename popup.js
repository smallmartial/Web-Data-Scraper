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

  wholePage.addEventListener('click', function() {
    currentMode = 'whole-page';
    wholePage.classList.add('active');
    selectorMode.classList.remove('active');
    selectorControls.style.display = 'none';
    selectedElements.style.display = 'none';
  });

  selectorMode.addEventListener('click', function() {
    currentMode = 'selector';
    selectorMode.classList.add('active');
    wholePage.classList.remove('active');
    selectorControls.style.display = 'block';
    selectedElements.style.display = 'block';
  });

  pickElementsBtn.addEventListener('click', function() {
    isPicking = !isPicking;
    if (isPicking) {
      startPicking();
    } else {
      stopPicking();
    }
  });

  function startPicking() {
    pickElementsBtn.textContent = 'Stop Picking';
    pickElementsBtn.classList.add('picking');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        files: ['picker.js']
      }).then(() => {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'startPicking' });
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
    if (message.type === 'elementSelected') {
      selectedSelectors = message.selectors;
      updateSelectedElementsList();
    } else if (message.type === 'pickingStopped') {
      isPicking = false;
      pickElementsBtn.textContent = 'Pick Elements';
      pickElementsBtn.classList.remove('picking');
    } else if (message.type === 'scrapeResult') {
      loadingElement.style.display = 'none';
      resultContainer.style.display = 'block';
      scrapeResult = message.data;
      resultPreview.textContent = JSON.stringify(scrapeResult, null, 2);
    }
  });

  function updateSelectedElementsList() {
    selectedItemsList.innerHTML = '';
    selectedSelectors.forEach(selector => {
      const item = document.createElement('div');
      item.className = 'selected-item';
      item.innerHTML = `
        <span>${selector}</span>
        <span class="remove">×</span>
      `;
      
      item.querySelector('.remove').addEventListener('click', () => {
        selectedSelectors = selectedSelectors.filter(s => s !== selector);
        updateSelectedElementsList();
      });
      
      selectedItemsList.appendChild(item);
    });
  }

  // Export functions remain the same...
  // [Previous downloadCSV and downloadJSON functions]

  wholePage.classList.add('active');
}); 