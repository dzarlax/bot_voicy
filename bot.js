require('dotenv').config();
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply('Привет! Отправьте мне видео, аудио файл или ссылку на видео.'));
bot.help((ctx) => ctx.reply('Отправьте видео или аудио файл для транскрибации.'));

const fs = require('fs');
const path = require('path');
const axios = require('axios');

bot.on(['audio', 'video'], async (ctx) => {
    let fileId;
    
    if (ctx.update.message.audio) {
      fileId = ctx.update.message.audio.file_id;
    } else if (ctx.update.message.video) {
      fileId = ctx.update.message.video.file_id;
    }
  
    // Проверка на наличие fileId перед продолжением
    if (!fileId) {
      console.log("Сообщение не содержит аудио или видео.");
      return; // Прерываем выполнение, если не найдено аудио или видео
    }
  
    let fileInfo = await ctx.telegram.getFile(fileId);
    let fileUrl = `https://api.telegram.org/file/bot${bot.token}/${fileInfo.file_path}`;
  
    const downloadsDir = path.resolve(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)){
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
  
    let localFilePath = path.resolve(downloadsDir, fileInfo.file_path.split('/').pop());
    let response = await axios({
      url: fileUrl,
      method: 'GET',
      responseType: 'stream'
    });
  
    response.data.pipe(fs.createWriteStream(localFilePath))
      .on('finish', () => {
        console.log(`Файл сохранен: ${localFilePath}`);
        transcribe(ctx, localFilePath); // Передаем ctx и путь к файлу в функцию transcribe
      })
      .on('error', e => console.error(e));
  });
  

  bot.on('text', async (ctx) => {
      ctx.reply("Пожалуйста, отправьте аудио или видео.");
  });
  

  bot.on('voice', async (ctx) => {
    const fileId = ctx.update.message.voice.file_id;
    const fileInfo = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${fileInfo.file_path}`;
  
    const downloadsDir = path.resolve(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)){
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
  
    const localFilePath = path.resolve(downloadsDir, fileInfo.file_path.split('/').pop());
    const response = await axios({
      url: fileUrl,
      method: 'GET',
      responseType: 'stream'
    });
  
    response.data.pipe(fs.createWriteStream(localFilePath))
      .on('finish', () => {
        console.log(`Голосовое сообщение сохранено: ${localFilePath}`);
        transcribe(ctx, localFilePath); // Обработка и отправка результата транскрибации
      })
      .on('error', e => console.error(e));
  });

  bot.on('video_note', async (ctx) => {
    const fileId = ctx.update.message.video_note.file_id; // Исправл
    const fileInfo = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${fileInfo.file_path}`;
  
    const downloadsDir = path.resolve(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)){
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
  
    const localFilePath = path.resolve(downloadsDir, fileInfo.file_path.split('/').pop());
    const response = await axios({
      url: fileUrl,
      method: 'GET',
      responseType: 'stream'
    });
  
    response.data.pipe(fs.createWriteStream(localFilePath))
      .on('finish', () => {
        console.log(`Видео сообщение сохранено: ${localFilePath}`);
        transcribe(ctx, localFilePath); // Обработка и отправка результата транскрибации
      })
      .on('error', e => console.error(e));
  });


  
  const { exec } = require('child_process');

  function transcribe(ctx, fileOrUrl) {
    // Убедитесь, что указан правильный путь до скрипта или исполняемого файла transcribe-anything
    let command = `transcribe-anything ${fileOrUrl}`;
  
    exec(command, async (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        await ctx.reply('Произошла ошибка при транскрибации.');
        return;
      }
      // Здесь stdout содержит путь к папке с результатами, а не сам результат транскрибации
      console.log(`Транскрибация завершена, результаты в: ${stdout}`);
      // Функция sendTranscriptionResult должна вызываться здесь
      await sendTranscriptionResult(ctx, fileOrUrl);
    });
  }
  
   

  const fsp = require('fs').promises; // Убедитесь, что используете версию fs с промисами

  async function sendTranscriptionResult(ctx, filePath) {
    const baseName = path.basename(filePath, path.extname(filePath));
    const transcriptionDirName = `text_${baseName}`;
    const transcriptionDir = path.resolve(__dirname, transcriptionDirName);
    const transcriptionFilePath = path.resolve(transcriptionDir, 'out.txt');
  
    try {
      const content = await fsp.readFile(transcriptionFilePath, 'utf8');
      if (content.length > 4096) {
        await ctx.replyWithDocument({ source: transcriptionFilePath, filename: `${transcriptionDirName}-transcription.txt` });
      } else {
        await ctx.reply(content);
      }
      // Удаление файла и папки после отправки
      await deleteTranscriptionResults(transcriptionDir, filePath); // Теперь передаём и filePath
    } catch (error) {
      console.error('Ошибка при чтении или удалении файла транскрибации:', error);
      await ctx.reply('Извините, произошла ошибка при обработке вашего запроса.');
    }
  }
  
  async function deleteTranscriptionResults(transcriptionDir, originalFilePath) {
    try {
      // Удаляем исходный файл
      await fsp.unlink(originalFilePath);
      console.log(`Исходный файл ${originalFilePath} успешно удалён.`);
      
      // Удаляем папку с результатами
      await fsp.rm(transcriptionDir, { recursive: true, force: true }); // Удаляем папку и все её содержимое
      console.log(`Папка с результатами ${transcriptionDir} и содержимое успешно удалены.`);
    } catch (error) {
      console.error('Ошибка при удалении исходного файла или папки с результатами транскрибации:', error);
    }
  }
  

bot.launch();