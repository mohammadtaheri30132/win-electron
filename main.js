const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  // باز کردن Developer Tools
  // mainWindow.webContents.openDevTools();
  
  // لاگ‌های renderer process را ببین
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`Renderer [${level}]: ${message} (${sourceId}:${line})`);
  });
}

app.whenReady().then(createWindow);

// مسیر فایل‌های JSON
const TEXT_FILE = path.join(__dirname, 'src', 'text.json');
const INFO_FILE = path.join(__dirname, 'src', 'information.json');

// تابع‌های کمکی برای خواندن و نوشتن JSON
async function loadJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    if (!content || content.trim() === '') {
      return [];
    }
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
    return [];
  }
}

async function saveJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// فقط یک بار این خط را داشته باشید:
// IPC Handlers - هر handler فقط یک بار
// در تابع get-books لاگ اضافه کنید
ipcMain.handle('get-books', async () => {
  try {
    console.log('=== get-books called ===');
    
  
    // بررسی وجود فایل‌ها
    try {
      await fs.access(TEXT_FILE);
      console.log('TEXT_FILE exists');
    } catch {
      console.log('TEXT_FILE does NOT exist');
    }
    
    try {
      await fs.access(INFO_FILE);
      console.log('INFO_FILE exists');
    } catch {
      console.log('INFO_FILE does NOT exist');
    }
    
    const texts = await loadJson(TEXT_FILE);
    const infos = await loadJson(INFO_FILE);
   
    const textMap = new Map();
    if (Array.isArray(texts)) {
      texts.forEach(t => {
        if (t && t.slug) {
          textMap.set(t.slug, t);
        }
      });
    }

    const books = infos.map(info => {
      if (!info) {
        return null;
      }
      
      const slug = info.slug || info.data?.slug;
      if (!slug) {
        return null;
      }
      
      const text = textMap.get(slug);
      
      return {
        slug: slug,
        name: info.data?.name || info.name || 'بدون نام',
        short_desc: info.data?.short_desc || info.short_desc || '',
        status: info.data?.status || info.status || 'ویرایش نشده',
        has_text: !!text,
        pages_count: text?.pages?.length || 0,
        about_the_author: info.data?.about_the_author || info.about_the_author,
        about_the_book: info.data?.about_the_book || info.about_the_book,
        book_review: info.data?.book_review || info.book_review,
        desc_book: info.data?.desc_book || info.desc_book,
        who_should_read: info.data?.who_should_read || info.who_should_read
      };
    }).filter(book => book !== null);

    
    return books;
  } catch (err) {
    console.error('Error in get-books:', err);
    console.error('Error stack:', err.stack);
    return [];
  }
});

ipcMain.handle('get-book', async (event, slug) => {
  try {
    const texts = await loadJson(TEXT_FILE);
    const infos = await loadJson(INFO_FILE);

    const textBook = texts.find(t => t.slug === slug);
    const infoBook = infos.find(i => (i.slug || i.data?.slug) === slug);

    if (!infoBook) throw new Error('کتاب یافت نشد');

    return {
      slug,
      data: infoBook.data || infoBook,
      pages: textBook?.pages || [],
      status: infoBook.data?.status || infoBook.status || 'ویرایش نشده',
    };
  } catch (err) {
    console.error(err);
    throw new Error('خطا در دریافت کتاب');
  }
});

ipcMain.handle('save-book', async (event, { slug, changedData, changedPages, status }) => {
  try {
    let infos = await loadJson(INFO_FILE);
    let texts = await loadJson(TEXT_FILE);

    const infoIndex = infos.findIndex(i => (i.slug || i.data?.slug) === slug);
    if (infoIndex === -1) throw new Error('کتاب یافت نشد');

    if (changedData && Object.keys(changedData).length > 0) {
      if (!infos[infoIndex].data) infos[infoIndex].data = {};
      Object.assign(infos[infoIndex].data, changedData);
    }

    if (status) {
      if (infos[infoIndex].data) {
        infos[infoIndex].data.status = status;
      } else {
        infos[infoIndex].status = status;
      }
    }

    const textIndex = texts.findIndex(t => t.slug === slug);
    if (textIndex !== -1 && changedPages && Array.isArray(changedPages)) {
      changedPages.forEach(({ index, title, content }) => {
        if (texts[textIndex].pages[index]) {
          if (title !== undefined) texts[textIndex].pages[index].title = title;
          if (content !== undefined) texts[textIndex].pages[index].content = content;
        }
      });
    }

    await saveJson(INFO_FILE, infos);
    if (textIndex !== -1) await saveJson(TEXT_FILE, texts);

    return { success: true };
  } catch (err) {
    console.error(err);
    throw new Error('خطا در ذخیره');
  }
});

ipcMain.handle('download-file', async (event, filename) => {
  try {
    const filePath = path.join(__dirname, 'src', filename);
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (err) {
    console.error(err);
    throw new Error('خطا در دانلود فایل');
  }
});

ipcMain.handle('add-info-json', async (event, { slug, jsonData }) => {
  try {
    const infos = await loadJson(INFO_FILE);
    
    const infoIndex = infos.findIndex(i => 
      (i.slug || i.data?.slug) === slug
    );
    
    if (infoIndex === -1) throw new Error('کتاب یافت نشد');
    
    if (!infos[infoIndex].data) infos[infoIndex].data = {};
    
    const allowedFields = [
      'about_the_author',
      'about_the_book',
      'book_review',
      'desc_book',
      'name',
      'short_desc',
      'who_should_read'
    ];
    
    allowedFields.forEach(field => {
      if (jsonData[field] !== undefined) {
        infos[infoIndex].data[field] = jsonData[field];
      }
    });
    
    await saveJson(INFO_FILE, infos);
    return { success: true };
  } catch (err) {
    console.error(err);
    throw new Error('خطا در افزودن JSON اطلاعات');
  }
});

ipcMain.handle('add-text-json', async (event, { slug, pages }) => {
  try {
    let texts = await loadJson(TEXT_FILE);
    
    const textIndex = texts.findIndex(t => t.slug === slug);
    
    if (textIndex === -1) {
      texts.push({
        slug: slug,
        pages: pages
      });
    } else {
      texts[textIndex].pages = pages;
    }
    
    await saveJson(TEXT_FILE, texts);
    return { success: true };
  } catch (err) {
    console.error(err);
    throw new Error('خطا در افزودن JSON متن');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});