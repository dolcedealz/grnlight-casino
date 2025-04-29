const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '.env');

// Проверка существования и содержания файла .env
console.log('Проверка файла .env:');
console.log('Путь:', envPath);
console.log('Существует:', fs.existsSync(envPath));
if (fs.existsSync(envPath)) {
  console.log('Содержимое:');
  console.log(fs.readFileSync(envPath, 'utf8'));
}

// Попытка загрузить переменные окружения
dotenv.config({ path: envPath });

console.log('\nПроверка переменных окружения:');
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('CASINO_BOT_TOKEN:', process.env.CASINO_BOT_TOKEN ? 'Установлен' : 'Не установлен');
console.log('ADMIN_BOT_TOKEN:', process.env.ADMIN_BOT_TOKEN ? 'Установлен' : 'Не установлен');
console.log('PORT:', process.env.PORT);
console.log('WEBAPP_URL:', process.env.WEBAPP_URL);
