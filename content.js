chrome.storage.local.get('scrapeConfig', function(data) {
  const config = data.scrapeConfig;
  
  if (config.mode === 'whole-page') {
    scrapeWholePage();
  } else if (config.mode === 'selector') {
    scrapeBySelectors(config.selectors);
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

function scrapeBySelectors(selectors) {
  if (!selectors || selectors.length === 0) {
    console.error('No selectors provided');
    return;
  }

  try {
    const data = selectors.map(selector => {
      const simplifiedSelector = simplifySelector(selector);
      const elements = document.querySelectorAll(simplifiedSelector);
      
      return {
        selector: simplifiedSelector,
        elements: Array.from(elements).map(element => {
          // 基础数据
          const baseData = {
            text: element.innerText.trim(),
            html: element.outerHTML,
            tagName: element.tagName.toLowerCase(),
            attributes: {
              id: element.id || null,
              class: element.className || null,
              href: element.href || null,
              type: element.type || null
            }
          };

          // 如果是图片元素，添加图片特有的属性
          if (element.tagName.toLowerCase() === 'img') {
            baseData.imageData = {
              src: element.src || null,
              alt: element.alt || null,
              naturalWidth: element.naturalWidth || null,
              naturalHeight: element.naturalHeight || null
            };
          }

          // 检查背景图片
          const computedStyle = window.getComputedStyle(element);
          const backgroundImage = computedStyle.backgroundImage;
          if (backgroundImage && backgroundImage !== 'none') {
            baseData.backgroundImage = backgroundImage.replace(/url\(['"]?(.*?)['"]?\)/g, '$1');
          }

          // 递归查找子元素中的图片
          const childImages = Array.from(element.querySelectorAll('img')).map(img => ({
            src: img.src || null,
            alt: img.alt || null,
            naturalWidth: img.naturalWidth || null,
            naturalHeight: img.naturalHeight || null
          }));

          if (childImages.length > 0) {
            baseData.childImages = childImages;
          }

          return baseData;
        })
      };
    }).filter(item => item.elements.length > 0);

    console.log('Selected elements data:', data);
    saveAndSendData(data, 'selector');
  } catch (error) {
    console.error('Selector scraping error:', error);
  }
}

function simplifySelector(selector) {
  const parts = selector.split('>').map(part => part.trim());
  const lastPart = parts[parts.length - 1];
  
  const simplified = lastPart.split('.').filter(part => {
    return !part.includes('scraper-') && 
           !part.includes('highlight') &&
           !part.includes('selected');
  }).join('.');
  
  return simplified;
}

function getElementAttributes(element) {
  const attributes = {};
  for (const attr of element.attributes) {
    if (!attr.name.includes('scraper-') && 
        !attr.value.includes('scraper-')) {
      attributes[attr.name] = attr.value;
    }
  }
  return attributes;
}

function saveAndSendData(data, type) {
  if (data.length === 0) {
    chrome.runtime.sendMessage({
      type: 'scrapeError',
      error: 'No elements found with the selected selectors'
    });
    return;
  }

  const saveObject = {
    data: data,
    timestamp: new Date().toISOString(),
    url: window.location.href
  };

  chrome.storage.local.set({
    [`scraped_${type}_data`]: saveObject
  }, function() {
    console.log('Data saved');
  });

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