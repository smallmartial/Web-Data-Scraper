chrome.storage.local.get('scrapeConfig', function(data) {
  const config = data.scrapeConfig;
  
  if (config.mode === 'whole-page') {
    scrapeWholePage();
  } else if (config.mode === 'selector') {
    scrapeBySelectorMode(config.selector);
  }
});

function scrapeWholePage() {
  const data = {
    title: document.title,
    url: window.location.href,
    content: document.body.innerText,
    html: document.documentElement.outerHTML
  };
  
  console.log('Whole page data:', data);
  saveAndSendData(data, 'whole-page');
}

function scrapeBySelectorMode(selector) {
  if (!selector) {
    console.error('No selector provided');
    return;
  }

  try {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) {
      console.warn('No matching elements found');
      return;
    }

    const data = Array.from(elements).map(element => ({
      text: element.innerText,
      html: element.outerHTML,
      attributes: getElementAttributes(element)
    }));

    console.log('Selector scraping data:', data);
    saveAndSendData(data, 'selector');
  } catch (error) {
    console.error('Selector scraping error:', error);
  }
}

function getElementAttributes(element) {
  const attributes = {};
  for (const attr of element.attributes) {
    attributes[attr.name] = attr.value;
  }
  return attributes;
}

function saveAndSendData(data, type) {
  const saveObject = {
    data: data,
    timestamp: new Date().toISOString(),
    url: window.location.href
  };

  // Save to storage
  chrome.storage.local.set({
    [`scraped_${type}_data`]: saveObject
  }, function() {
    console.log('Data saved');
  });

  // Send message to popup
  chrome.runtime.sendMessage({
    type: 'scrapeResult',
    data: data
  });
}

// Add download functionality
function downloadData(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'scraped-data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
} 