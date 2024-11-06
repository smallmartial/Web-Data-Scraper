let isPickingElement = false;
let highlightedElement = null;
let selectedElements = new Set();

function initializePicker() {
  document.body.style.cursor = 'crosshair';
  
  // Add highlight styles
  const style = document.createElement('style');
  style.textContent = `
    .scraper-highlight {
      outline: 2px solid #4285f4 !important;
      background-color: rgba(66, 133, 244, 0.1) !important;
    }
    .scraper-selected {
      outline: 2px solid #34a853 !important;
      background-color: rgba(52, 168, 83, 0.1) !important;
    }
  `;
  document.head.appendChild(style);

  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeyDown);
}

function handleMouseOver(e) {
  if (!isPickingElement) return;
  e.preventDefault();
  e.stopPropagation();
  
  if (highlightedElement) {
    highlightedElement.classList.remove('scraper-highlight');
  }
  
  highlightedElement = e.target;
  if (!selectedElements.has(getElementSelector(highlightedElement))) {
    highlightedElement.classList.add('scraper-highlight');
  }
}

function handleMouseOut(e) {
  if (!isPickingElement || !highlightedElement) return;
  e.preventDefault();
  e.stopPropagation();
  
  if (!selectedElements.has(getElementSelector(highlightedElement))) {
    highlightedElement.classList.remove('scraper-highlight');
  }
}

function handleClick(e) {
  if (!isPickingElement) return;
  e.preventDefault();
  e.stopPropagation();
  
  const selector = getElementSelector(e.target);
  const similarElements = document.querySelectorAll(selector);
  
  // 高亮显示所有匹配的元素
  similarElements.forEach(element => {
    if (selectedElements.has(selector)) {
      element.classList.remove('scraper-selected');
    } else {
      element.classList.add('scraper-selected');
    }
  });

  if (selectedElements.has(selector)) {
    selectedElements.delete(selector);
  } else {
    selectedElements.add(selector);
  }

  // 发送预览数据，包括所有匹配元素的信息
  const previewData = Array.from(selectedElements).map(sel => {
    const elements = document.querySelectorAll(sel);
    return {
      selector: sel,
      count: elements.length,
      preview: Array.from(elements).slice(0, 3).map(element => ({
        text: element.innerText.substring(0, 100) + (element.innerText.length > 100 ? '...' : ''),
        tag: element.tagName.toLowerCase()
      }))
    };
  });

  chrome.runtime.sendMessage({
    type: 'elementSelected',
    selectors: Array.from(selectedElements),
    preview: previewData
  });
}

function handleKeyDown(e) {
  if (e.key === 'Escape' && isPickingElement) {
    stopPicking();
  }
}

function getElementSelector(element) {
  // 如果元素有 id，且 id 不是动态生成的（不包含数字），则使用 id
  if (element.id && !/\d/.test(element.id)) {
    return `#${element.id}`;
  }
  
  let selector = '';
  let current = element;
  let path = [];
  
  while (current && current !== document.body) {
    // 获取元素的基本信息
    let level = {
      tag: current.tagName.toLowerCase(),
      classes: Array.from(current.classList).filter(cls => 
        // 过滤掉可能是动态生成或我们添加的类
        !cls.includes('scraper-') && 
        !cls.includes('highlight') && 
        !cls.includes('selected') &&
        !/\d/.test(cls) // 过滤掉包含数字的类名
      ),
      attributes: Array.from(current.attributes)
        .filter(attr => 
          // 保留可能有用的属性
          ['data-type', 'role', 'type', 'name'].includes(attr.name) &&
          !attr.value.includes('scraper-')
        )
        .map(attr => `[${attr.name}="${attr.value}"]`)
    };

    // 构建当前层级的选择器
    let levelSelector = level.tag;
    if (level.classes.length > 0) {
      // 只使用看起来是结构相关的类名
      const structuralClasses = level.classes.filter(cls => 
        cls.includes('wrapper') || 
        cls.includes('container') || 
        cls.includes('item') || 
        cls.includes('list') ||
        cls.includes('card') ||
        cls.includes('row') ||
        cls.includes('col')
      );
      if (structuralClasses.length > 0) {
        levelSelector += '.' + structuralClasses.join('.');
      }
    }
    levelSelector += level.attributes.join('');
    
    path.unshift(levelSelector);
    
    // 如果找到一个看起来是列表项的父元素，就停止向上查找
    if (isListContainer(current.parentElement)) {
      break;
    }
    
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

// 判断元素是否是列表容器
function isListContainer(element) {
  if (!element) return false;
  
  // 检查标签
  if (['ul', 'ol', 'tbody', 'div'].includes(element.tagName.toLowerCase())) {
    // 检查类名是否包含列表相关的关键词
    const className = element.className.toLowerCase();
    return className.includes('list') || 
           className.includes('container') ||
           className.includes('wrapper') ||
           className.includes('items') ||
           className.includes('results');
  }
  return false;
}

function startPicking() {
  isPickingElement = true;
  initializePicker();
}

function stopPicking() {
  isPickingElement = false;
  document.body.style.cursor = '';
  
  if (highlightedElement) {
    highlightedElement.classList.remove('scraper-highlight');
    highlightedElement = null;
  }
  
  document.removeEventListener('mouseover', handleMouseOver);
  document.removeEventListener('mouseout', handleMouseOut);
  document.removeEventListener('click', handleClick);
  document.removeEventListener('keydown', handleKeyDown);
  
  // 获取预览数据
  const previewData = Array.from(selectedElements).map(selector => {
    const elements = document.querySelectorAll(selector);
    return {
      selector: selector,
      preview: Array.from(elements).map(element => ({
        text: element.innerText.substring(0, 100) + (element.innerText.length > 100 ? '...' : ''),
        tag: element.tagName.toLowerCase()
      }))
    };
  });

  // 发送停止选择消息和预览数据
  chrome.runtime.sendMessage({ 
    type: 'pickingStopped',
    selectors: Array.from(selectedElements),
    preview: previewData
  });
}

function restoreSelectedElements(selectors) {
  if (selectors && selectors.length > 0) {
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        element.classList.add('scraper-selected');
        selectedElements.add(selector);
      });
    });
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'startPicking') {
    startPicking();
    if (message.selectors) {
      restoreSelectedElements(message.selectors);
    }
  } else if (message.type === 'stopPicking') {
    stopPicking();
  }
}); 