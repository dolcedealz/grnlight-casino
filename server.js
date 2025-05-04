const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');

// Импортируем фабрики ботов под другими именами
const createCasinoBot = require('./bots/casinoBot');
const createAdminBot = require('./bots/adminBot');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

const CASINO_BOT_TOKEN = process.env.CASINO_BOT_TOKEN;
const ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN;

console.log('Tokens:', { CASINO_BOT_TOKEN, ADMIN_BOT_TOKEN });

// Создаём экземпляры ботов
const casinoBot = createCasinoBot(CASINO_BOT_TOKEN);
const adminBot = createAdminBot(ADMIN_BOT_TOKEN);

// Делаем казино бота доступным глобально для отправки уведомлений
global.casinoBot = casinoBot;

// Connect to database
connectDB();

// Initialize express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/games', require('./routes/gameRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/disputes', require('./routes/disputeRoutes')); // Добавляем новый роут для споров

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Запуск ботов
casinoBot.launch()
  .then(() => console.log('Casino bot started'))
  .catch(err => console.error('Casino bot error:', err));

adminBot.launch()
  .then(() => console.log('Admin bot started'))
  .catch(err => console.error('Admin bot error:', err));

// Грейсфул-выход
process.once('SIGINT', () => { casinoBot.stop('SIGINT'); adminBot.stop('SIGINT'); });
process.once('SIGTERM', () => { casinoBot.stop('SIGTERM'); adminBot.stop('SIGTERM'); });