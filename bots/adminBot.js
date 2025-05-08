const { Telegraf } = require('telegraf');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GameHistory = require('../models/GameHistory');
const moment = require('moment');

// Экспортируем функцию, которая создает и возвращает бота
module.exports = (token) => {
  console.log('Создание Admin бота с токеном:', token);
  
  // Initialize the bot with passed token
  const bot = new Telegraf(token);
  
  // Admin IDs - добавляем новых администраторов
  const ADMIN_IDS = [8052397593, 1240742785, 418684940]; 
  
  // Middleware для проверки прав администратора
  const isAdmin = async (ctx, next) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) {
      return ctx.reply('Доступ запрещен. Вы не являетесь администратором.');
    }
    
    // Check if user exists in database and make them admin if needed
    let user = await User.findOne({ telegramId: ctx.from.id });
    
    if (!user) {
      user = new User({
        telegramId: ctx.from.id,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name || '',
        username: ctx.from.username || '',
        isAdmin: true
      });
      
      await user.save();
    } else if (!user.isAdmin) {
      user.isAdmin = true;
      await user.save();
    }
    
    return next();
  };
  
  // Apply admin check to all commands
  bot.use(isAdmin);

// Start command с обновленным меню
bot.start((ctx) => {
  ctx.reply(`
Добро пожаловать в панель администратора Greenlight Casino, ${ctx.from.first_name}!

📋 Основные команды:
/users - Список всех пользователей
/user [telegramId] - Детали пользователя
/winrate [telegramId] [rate] - Установить шанс выигрыша (0-1)
/setbalance [telegramId] [amount] - Установить баланс
/ban [telegramId] - Заблокировать/разблокировать пользователя

📊 Аналитика и статистика:
/stats - Общая статистика казино
/income [day|week|month|all] - Доходы за период 
/games [period] - Статистика по играм
/topplayers [count] - Лучшие игроки

🔍 Расширенный поиск:
/userlist [params] - Список пользователей с фильтрами
/transactions [params] - Анализ транзакций
/activity [period] - Отчет по активности пользователей
/export [type] - Экспорт данных в CSV

📈 Финансовые отчеты:
/dailyreport - Отчет за сегодня
/weeklyreport - Отчет за неделю 
/monthlyreport - Отчет за месяц
/customreport [from] [to] - Отчет за период

Для полной информации о команде используйте /help [команда]
  `);
});

// Команда помощи
bot.command('help', async (ctx) => {
  const command = ctx.message.text.split(' ')[1];
  
  if (!command) {
    return ctx.reply(`
📋 Справка по командам админ-панели:

- /userlist - Расширенный список пользователей
  Параметры: [sort:field] [filter:field=value] [limit:N]
  Пример: /userlist sort:balance filter:isBanned=true limit:20

- /income - Анализ доходов казино
  Параметры: [day|week|month|year|all]
  Пример: /income week

- /games - Статистика по играм
  Параметры: [period] [sort:field]
  Пример: /games month sort:profit

- /export - Экспорт данных в CSV
  Параметры: [users|transactions|games]
  Пример: /export users

Для получения подробной информации о конкретной команде используйте /help [команда]
    `);
  }
  
  // Подробная справка по конкретным командам
  switch(command) {
    case 'userlist':
      return ctx.reply(`
📋 Команда /userlist - расширенный список пользователей

Параметры:
- sort:[field] - сортировка по полю (balance, winRate, lastActivity)
- filter:[field=value] - фильтрация (isBanned=true/false, isAdmin=true/false)
- limit:[N] - ограничение количества результатов
- page:[N] - номер страницы при пагинации

Примеры:
/userlist sort:balance - сортировка по балансу (по убыванию)
/userlist sort:balance:asc - сортировка по балансу (по возрастанию)
/userlist filter:isBanned=true - только заблокированные
/userlist filter:balance>1000 - с балансом больше 1000
/userlist limit:10 page:2 - вторая страница по 10 пользователей
      `);
    
    case 'income':
      return ctx.reply(`
💰 Команда /income - анализ доходов казино

Параметры:
- day - статистика за сегодня
- week - статистика за текущую неделю
- month - статистика за текущий месяц
- year - статистика за текущий год 
- all - общая статистика
- [YYYY-MM-DD] - статистика за конкретную дату
- [YYYY-MM-DD] [YYYY-MM-DD] - статистика за период

Примеры:
/income day - доход за сегодня
/income week - доход за неделю
/income 2023-10-01 - доход за 1 октября 2023
/income 2023-10-01 2023-10-31 - доход за октябрь 2023
      `);
    
    case 'games':
      return ctx.reply(`
🎮 Команда /games - статистика по играм

Параметры:
- [period] - период (day, week, month, year, all)
- sort:[field] - сортировка (count, bets, wins, profit, margin)

Примеры:
/games week - статистика игр за неделю
/games month sort:profit - игры за месяц, отсортированные по прибыли
/games all sort:count - все игры, отсортированные по количеству сессий
      `);
    
    default:
      return ctx.reply(`Справка по команде /${command} не найдена.`);
  }
});

// Улучшенная команда списка пользователей
bot.command('userlist', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ').slice(1);
    
    // Параметры по умолчанию
    let sortField = 'createdAt';
    let sortOrder = -1; // По умолчанию сортируем по убыванию (новые первыми)
    let filterObj = {};
    let limit = 20;
    let skip = 0;
    
    // Парсинг параметров
    for (const arg of args) {
      if (arg.startsWith('sort:')) {
        const sortParam = arg.replace('sort:', '').split(':');
        sortField = sortParam[0];
        if (sortParam.length > 1 && sortParam[1] === 'asc') {
          sortOrder = 1;
        }
      } else if (arg.startsWith('filter:')) {
        const filter = arg.replace('filter:', '');
        // Поддержка операторов сравнения
        if (filter.includes('>')) {
          const [key, value] = filter.split('>');
          filterObj[key] = { $gt: isNaN(value) ? value : Number(value) };
        } else if (filter.includes('<')) {
          const [key, value] = filter.split('<');
          filterObj[key] = { $lt: isNaN(value) ? value : Number(value) };
        } else if (filter.includes('=')) {
          const [key, value] = filter.split('=');
          filterObj[key] = value === 'true' ? true : (value === 'false' ? false : value);
        }
      } else if (arg.startsWith('limit:')) {
        limit = parseInt(arg.replace('limit:', ''));
      } else if (arg.startsWith('page:')) {
        const page = parseInt(arg.replace('page:', '')) - 1;
        skip = page >= 0 ? page * limit : 0;
      }
    }
    
    // Создаем объект для сортировки
    const sortObj = {};
    sortObj[sortField] = sortOrder;
    
    // Запрос к базе данных с пагинацией и сортировкой
    const totalUsers = await User.countDocuments(filterObj);
    const users = await User.find(filterObj)
                           .sort(sortObj)
                           .skip(skip)
                           .limit(limit);
    
    // Подготовка данных для вывода
    if (users.length === 0) {
      return ctx.reply('Пользователи не найдены по заданным критериям.');
    }
    
    let message = `📋 *Список пользователей* (${skip+1}-${Math.min(skip+limit, totalUsers)} из ${totalUsers})\n\n`;
    
    for (const user of users) {
      const lastActivityDate = user.lastActivity ? 
        moment(user.lastActivity).format('DD.MM.YY HH:mm') : 'N/A';
        
      message += `🆔 ${user.telegramId} - ${user.firstName} ${user.lastName || ''}\n`;
      message += `💰 Баланс: ${user.balance} ⭐ | 🎲 Шанс: ${user.winRate}\n`;
      message += `📅 Активность: ${lastActivityDate}\n`;
      message += `${user.isBanned ? '🚫 ЗАБАНЕН' : '✅ Активен'}\n\n`;
    }
    
    // Добавляем навигацию
    if (totalUsers > limit) {
      const currentPage = Math.floor(skip / limit) + 1;
      const totalPages = Math.ceil(totalUsers / limit);
      message += `📄 Страница ${currentPage}/${totalPages}\n`;
      
      if (currentPage > 1) {
        message += `Используйте параметр page:${currentPage-1} для предыдущей страницы.\n`;
      }
      
      if (currentPage < totalPages) {
        message += `Используйте параметр page:${currentPage+1} для следующей страницы.`;
      }
    }
    
    ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Ошибка команды userlist:', error);
    ctx.reply('❌ Ошибка при получении списка пользователей.');
  }
});

// Команда списка пользователей (старая версия для совместимости)
bot.command('users', async (ctx) => {
  try {
    const users = await User.find().limit(20).sort({ createdAt: -1 });
    
    if (users.length === 0) {
      return ctx.reply('No users found.');
    }
    
    let message = 'Recent users:\n\n';
    
    for (const user of users) {
      message += `ID: ${user.telegramId}\n`;
      message += `Name: ${user.firstName} ${user.lastName || ''}\n`;
      message += `Username: ${user.username ? '@' + user.username : 'N/A'}\n`;
      message += `Balance: ${user.balance} Stars\n`;
      message += `Win Rate: ${user.winRate}\n`;
      message += `Status: ${user.isBanned ? '🚫 BANNED' : '✅ Active'}\n\n`;
    }
    
    ctx.reply(message);
  } catch (error) {
    console.error('Users command error:', error);
    ctx.reply('Error retrieving users.');
  }
});

// Расширенная команда получения данных пользователя
bot.command('user', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const telegramId = args[1];
    
    if (!telegramId) {
      return ctx.reply('Пожалуйста, укажите Telegram ID. Использование: /user [telegramId]');
    }
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('Пользователь не найден.');
    }
    
    // Расширенная статистика пользователя
    const [ deposits, bets, wins, transactions, games, lastGames, lastActivity ] = await Promise.all([
      // Общая сумма депозитов
      Transaction.aggregate([
        { $match: { telegramId: parseInt(telegramId), type: 'deposit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // Общая сумма ставок
      Transaction.aggregate([
        { $match: { telegramId: parseInt(telegramId), type: 'bet' } },
        { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
      ]),
      
      // Общая сумма выигрышей
      Transaction.aggregate([
        { $match: { telegramId: parseInt(telegramId), type: 'win' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // Последние транзакции
      Transaction.find({ telegramId: parseInt(telegramId) })
                .sort({ createdAt: -1 })
                .limit(5),
      
      // Статистика по играм
      GameHistory.aggregate([
        { $match: { telegramId: parseInt(telegramId) } },
        { $group: { 
          _id: '$gameType', 
          count: { $sum: 1 },
          totalBet: { $sum: '$betAmount' },
          totalWin: { $sum: '$winAmount' },
          wins: { $sum: { $cond: [{ $eq: ['$outcome', 'win'] }, 1, 0] } }
        }}
      ]),
      
      // Последние игры
      GameHistory.find({ telegramId: parseInt(telegramId) })
                 .sort({ createdAt: -1 })
                 .limit(5),
      
      // Последняя активность
      GameHistory.findOne({ telegramId: parseInt(telegramId) })
                 .sort({ createdAt: -1 })
    ]);
    
    // Форматируем дату последней активности
    const lastActivityDate = lastActivity 
      ? moment(lastActivity.createdAt).format('DD.MM.YYYY HH:mm:ss')
      : 'Не определено';
    
    // Расчет итоговых показателей
    const totalDeposited = deposits[0]?.total || 0;
    const totalBets = bets[0]?.total || 0;
    const totalWins = wins[0]?.total || 0;
    const profitFromUser = totalBets - totalWins;
    const profitMargin = totalBets > 0 ? (profitFromUser / totalBets) * 100 : 0;
    
    // Подготовка сообщения со статистикой
    let message = `📊 *ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ*\n\n`;
    message += `👤 *Основная информация:*\n`;
    message += `🆔 ID: ${user.telegramId}\n`;
    message += `👤 Имя: ${user.firstName} ${user.lastName || ''}\n`;
    message += `🔤 Имя пользователя: ${user.username ? '@' + user.username : 'Отсутствует'}\n`;
    message += `💰 Баланс: ${user.balance} ⭐\n`;
    message += `🎲 Шанс выигрыша: ${user.winRate}\n`;
    message += `🚦 Статус: ${user.isBanned ? '🚫 ЗАБАНЕН' : '✅ Активен'}\n`;
    message += `🕒 Последняя активность: ${lastActivityDate}\n`;
    message += `📅 Регистрация: ${moment(user.createdAt).format('DD.MM.YYYY')}\n\n`;
    
    message += `💵 *Финансовая статистика:*\n`;
    message += `📥 Всего пополнений: ${totalDeposited} ⭐\n`;
    message += `🎮 Всего ставок: ${totalBets} ⭐\n`;
    message += `🏆 Всего выигрышей: ${totalWins} ⭐\n`;
    message += `📈 Прибыль казино: ${profitFromUser} ⭐ (${profitMargin.toFixed(2)}%)\n\n`;
    
    // Статистика по играм
    if (games.length > 0) {
      message += `🎲 *Статистика по играм:*\n`;
      
      for (const game of games) {
        const gameWinRate = game.count > 0 ? (game.wins / game.count) * 100 : 0;
        const gameProfit = game.totalBet - game.totalWin;
        
        message += `${getGameEmoji(game._id)} ${capitalizeFirstLetter(game._id)}: ${game.count} игр\n`;
        message += `   Ставки: ${game.totalBet} ⭐ | Выигрыши: ${game.totalWin} ⭐\n`;
        message += `   Процент побед: ${gameWinRate.toFixed(2)}% | Прибыль: ${gameProfit} ⭐\n`;
      }
      
      message += `\n`;
    }
    
    // Последние транзакции
    if (transactions.length > 0) {
      message += `💸 *Последние транзакции:*\n`;
      
      for (const tx of transactions) {
        const txDate = moment(tx.createdAt).format('DD.MM HH:mm');
        const txType = getTransactionTypeEmoji(tx.type);
        
        message += `${txDate} ${txType} ${tx.type}: ${tx.amount > 0 ? '+' : ''}${tx.amount} ⭐\n`;
      }
      
      message += `\n`;
    }
    
    ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('User command error:', error);
    ctx.reply('Error retrieving user data.');
  }
});

// Установка шанса выигрыша
bot.command('winrate', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const telegramId = args[1];
    const winRate = parseFloat(args[2]);
    
    if (!telegramId || isNaN(winRate)) {
      return ctx.reply('Пожалуйста, укажите Telegram ID и шанс выигрыша. Использование: /winrate [telegramId] [rate]');
    }
    
    if (winRate < 0 || winRate > 1) {
      return ctx.reply('Шанс выигрыша должен быть между 0 и 1.');
    }
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('Пользователь не найден.');
    }
    
    // Сохраняем текущий шанс для логирования
    const prevWinRate = user.winRate;
    
    user.winRate = winRate;
    await user.save();
    
    // Расширенный ответ для администратора
    ctx.reply(`
✅ Шанс выигрыша обновлен!

👤 Пользователь: ${user.firstName} ${user.lastName || ''} (ID: ${user.telegramId})
🎲 Старый шанс: ${prevWinRate}
🎲 Новый шанс: ${winRate}

При шансе ${winRate}:
- Вероятность выигрыша пользователя: ${(winRate*100).toFixed(2)}%
- Ожидаемая прибыль казино: ${((1-winRate)*100).toFixed(2)}%
    `);
  } catch (error) {
    console.error('Winrate command error:', error);
    ctx.reply('Error updating win rate.');
  }
});

// Установка баланса
bot.command('setbalance', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const telegramId = args[1];
    const balance = parseInt(args[2]);
    
    if (!telegramId || isNaN(balance)) {
      return ctx.reply('Пожалуйста, укажите Telegram ID и сумму баланса. Использование: /setbalance [telegramId] [amount]');
    }
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('Пользователь не найден.');
    }
    
    // Сохраняем текущий баланс для логирования
    const prevBalance = user.balance;
    const difference = balance - prevBalance;
    
    // Записываем транзакцию
    const transaction = new Transaction({
      userId: user._id,
      telegramId: user.telegramId,
      amount: difference,
      type: 'admin_adjustment'
    });
    
    await transaction.save();
    
    // Обновляем баланс
    user.balance = balance;
    await user.save();
    
    ctx.reply(`
✅ Баланс пользователя обновлен!

👤 Пользователь: ${user.firstName} ${user.lastName || ''} (ID: ${user.telegramId})
💰 Старый баланс: ${prevBalance} ⭐
💰 Новый баланс: ${balance} ⭐
${difference >= 0 ? '📈' : '📉'} Изменение: ${difference > 0 ? '+' : ''}${difference} ⭐

🕒 Операция зарегистрирована как административная корректировка.
    `);
  } catch (error) {
    console.error('Setbalance command error:', error);
    ctx.reply('Error updating balance.');
  }
});

// Блокировка/разблокировка пользователя
bot.command('ban', async (ctx) => {
  try {
    const telegramId = ctx.message.text.split(' ')[1];
    
    if (!telegramId) {
      return ctx.reply('Пожалуйста, укажите Telegram ID. Использование: /ban [telegramId]');
    }
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('Пользователь не найден.');
    }
    
    // Инвертируем статус
    user.isBanned = !user.isBanned;
    await user.save();
    
    ctx.reply(`
${user.isBanned ? '🚫' : '✅'} Пользователь ${user.firstName} ${user.lastName || ''} (ID: ${user.telegramId}) успешно ${user.isBanned ? 'заблокирован' : 'разблокирован'}.

Текущий статус: ${user.isBanned ? '🚫 ЗАБЛОКИРОВАН' : '✅ АКТИВЕН'}
    `);
  } catch (error) {
    console.error('Ban command error:', error);
    ctx.reply('Error toggling ban status.');
  }
});

// Статистика казино (улучшенная версия)
bot.command('stats', async (ctx) => {
  try {
    // Параметры статистики
    const args = ctx.message.text.split(' ');
    const period = args[1] || 'all'; // По умолчанию показываем всю статистику
    
    // Определяем временные рамки для статистики
    let dateFilter = {};
    const now = new Date();
    
    if (period === 'day') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { $gte: startOfDay } };
    } else if (period === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: startOfWeek } };
    } else if (period === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: startOfMonth } };
    }
    
    // Получаем все статистические данные параллельно
    const [
      userStats,
      depositsData,
      withdrawalsData,
      betsData,
      winsData,
      gameStatsData,
      newUsers,
      activeUsers,
      bannedUsers
    ] = await Promise.all([
      // Статистика пользователей
      User.aggregate([
        { $group: { _id: null, total: { $sum: 1 } } }
      ]),
      
      // Депозиты
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'deposit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // Выводы
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'withdrawal' } },
        { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
      ]),
      
      // Ставки
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'bet' } },
        { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
      ]),
      
      // Выигрыши
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'win' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // Статистика по играм
      GameHistory.aggregate([
        { $match: dateFilter },
        { $group: { 
          _id: '$gameType', 
          count: { $sum: 1 },
          totalBet: { $sum: '$betAmount' },
          totalWin: { $sum: '$winAmount' },
          uniqueUsers: { $addToSet: '$telegramId' }
        }}
      ]),
      
      // Новые пользователи за выбранный период
      User.countDocuments({ ...dateFilter }),
      
      // Активные пользователи (сделавшие хотя бы одну ставку за период)
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'bet' } },
        { $group: { _id: '$telegramId' } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]),
      
      // Заблокированные пользователи
      User.countDocuments({ isBanned: true })
    ]);
    
    // Расчет финансовых показателей
    const totalUsers = userStats[0]?.total || 0;
    const deposits = depositsData[0]?.total || 0;
    const withdrawals = withdrawalsData[0]?.total || 0;
    const bets = betsData[0]?.total || 0;
    const wins = winsData[0]?.total || 0;
    
    const grossProfit = bets - wins;
    const profitMargin = bets > 0 ? (grossProfit / bets) * 100 : 0;
    const netDeposits = deposits - withdrawals;
    
    // Активные пользователи
    const activeCount = activeUsers[0]?.count || 0;
    const activeRate = totalUsers > 0 ? (activeCount / totalUsers) * 100 : 0;
    
    // Преобразуем игровую статистику в удобный формат
    const gameStats = gameStatsData.map(game => {
      const profit = game.totalBet - game.totalWin;
      const profitMargin = game.totalBet > 0 ? (profit / game.totalBet) * 100 : 0;
      const uniquePlayers = game.uniqueUsers ? game.uniqueUsers.length : 0;
      
      return {
        gameType: game._id,
        count: game.count,
        totalBet: game.totalBet,
        totalWin: game.totalWin,
        profit,
        profitMargin,
        uniquePlayers
      };
    });
    
    // Сортируем игры по прибыли (по убыванию)
    gameStats.sort((a, b) => b.profit - a.profit);
    
    // Период для заголовка
    let periodTitle = '';
    switch(period) {
      case 'day': periodTitle = 'за сегодня'; break;
      case 'week': periodTitle = 'за неделю'; break;
      case 'month': periodTitle = 'за месяц'; break;
      default: periodTitle = 'за все время'; break;
    }
    
    // Формируем сообщение статистики
    let message = `📊 *СТАТИСТИКА КАЗИНО* ${periodTitle}\n\n`;
    
    message += `👥 *Пользователи:*\n`;
    message += `• Всего пользователей: ${totalUsers}\n`;
    message += `• Новых ${periodTitle}: ${newUsers}\n`;
    message += `• Активных ${periodTitle}: ${activeCount} (${activeRate.toFixed(2)}%)\n`;
    message += `• Заблокировано: ${bannedUsers}\n\n`;
    
    message += `💰 *Финансы:*\n`;
    message += `• Депозиты: ${deposits} ⭐\n`;
    message += `• Выводы: ${withdrawals} ⭐\n`;
    message += `• Ставки: ${bets} ⭐\n`;
    message += `• Выигрыши: ${wins} ⭐\n`;
    message += `• Валовая прибыль: ${grossProfit} ⭐ (${profitMargin.toFixed(2)}%)\n`;
    message += `• Чистый приток: ${netDeposits} ⭐\n\n`;
    
    message += `🎲 *Популярность игр:*\n`;
    
    // Добавляем статистику по играм
    for (const game of gameStats) {
      message += `${getGameEmoji(game.gameType)} ${capitalizeFirstLetter(game.gameType)}:\n`;
      message += `  • Сессий: ${game.count} | Игроков: ${game.uniquePlayers}\n`;
      message += `  • Ставки: ${game.totalBet} ⭐ | Выигрыши: ${game.totalWin} ⭐\n`;
      message += `  • Прибыль: ${game.profit} ⭐ (${game.profitMargin.toFixed(2)}%)\n`;
    }
    
    // Добавляем рекомендации на основе статистики
    message += `\n📈 *Аналитика:*\n`;
    
    // Рекомендации по ROI
    if (profitMargin < 10) {
      message += `⚠️ Маржа прибыли (${profitMargin.toFixed(2)}%) ниже рекомендуемой (10%+).\n`;
      message += `   Рекомендуется снизить шансы выигрыша для увеличения прибыли.\n`;
    } else if (profitMargin > 30) {
      message += `⚠️ Маржа прибыли (${profitMargin.toFixed(2)}%) слишком высокая.\n`;
      message += `   Рекомендуется повысить шансы выигрыша для удержания игроков.\n`;
    } else {
      message += `✅ Маржа прибыли (${profitMargin.toFixed(2)}%) находится в оптимальном диапазоне.\n`;
    }
    
    // Рекомендации по улучшению
    if (gameStats.length > 0) {
      // Находим самую прибыльную и самую убыточную игру
      const mostProfitable = gameStats[0];
      const leastProfitable = gameStats[gameStats.length - 1];
      
      if (mostProfitable.profit > 0) {
        message += `💡 Самая прибыльная игра: ${capitalizeFirstLetter(mostProfitable.gameType)} (${mostProfitable.profit} ⭐)\n`;
      }
      
      if (leastProfitable.profit < 0) {
        message += `⚠️ Убыточная игра: ${capitalizeFirstLetter(leastProfitable.gameType)} (${leastProfitable.profit} ⭐)\n`;
        message += `   Рекомендуется настроить шансы выигрыша для этой игры.\n`;
      }
    }
    
    ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Stats command error:', error);
    ctx.reply('Error retrieving statistics.');
  }
});

// Команда для анализа доходов за период
bot.command('income', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const period = args[1] || 'all';
    
    // Определяем временные рамки для статистики
    let dateFilter = {};
    let periodTitle = '';
    const now = new Date();

    // Настраиваем фильтр по дате в зависимости от запрошенного периода
    if (period === 'day') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { $gte: startOfDay } };
      periodTitle = 'за сегодня';
    } else if (period === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: startOfWeek } };
      periodTitle = 'за текущую неделю';
    } else if (period === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: startOfMonth } };
      periodTitle = 'за текущий месяц';
    } else if (period.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Если передана дата в формате YYYY-MM-DD
      const [year, month, day] = period.split('-').map(Number);
      const startDate = new Date(year, month - 1, day);
      const endDate = new Date(year, month - 1, day + 1);
      dateFilter = { createdAt: { $gte: startDate, $lt: endDate } };
      periodTitle = `за ${day}.${month}.${year}`;
    } else if (args.length >= 3 && args[1].match(/^\d{4}-\d{2}-\d{2}$/) && args[2].match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Если переданы две даты - период
      const [startYear, startMonth, startDay] = args[1].split('-').map(Number);
      const [endYear, endMonth, endDay] = args[2].split('-').map(Number);
      
      const startDate = new Date(startYear, startMonth - 1, startDay);
      const endDate = new Date(endYear, endMonth - 1, endDay + 1);
      
      dateFilter = { createdAt: { $gte: startDate, $lt: endDate } };
      periodTitle = `с ${startDay}.${startMonth}.${startYear} по ${endDay}.${endMonth}.${endYear}`;
    } else {
      periodTitle = 'за все время';
    }
    
    // Получаем данные о транзакциях
    const [
      deposits,
      withdrawals,
      bets,
      wins,
      adminAdjustments,
      dailyStats
    ] = await Promise.all([
      // Депозиты
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'deposit' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      
      // Выводы
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'withdrawal' } },
        { $group: { _id: null, total: { $sum: { $abs: '$amount' } }, count: { $sum: 1 } } }
      ]),
      
      // Ставки
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'bet' } },
        { $group: { _id: null, total: { $sum: { $abs: '$amount' } }, count: { $sum: 1 } } }
      ]),
      
      // Выигрыши
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'win' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      
      // Административные корректировки
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'admin_adjustment' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      
      // Статистика по дням (для графиков)
      Transaction.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
              type: '$type'
            },
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ])
    ]);
    
    // Финансовые показатели
    const depositsTotal = deposits[0]?.total || 0;
    const depositsCount = deposits[0]?.count || 0;
    
    const withdrawalsTotal = withdrawals[0]?.total || 0;
    const withdrawalsCount = withdrawals[0]?.count || 0;
    
    const betsTotal = bets[0]?.total || 0;
    const betsCount = bets[0]?.count || 0;
    
    const winsTotal = wins[0]?.total || 0;
    const winsCount = wins[0]?.count || 0;
    
    const adjustmentsTotal = adminAdjustments[0]?.total || 0;
    const adjustmentsCount = adminAdjustments[0]?.count || 0;
    
    // Расчет ключевых показателей
    const grossProfit = betsTotal - winsTotal;
    const profitMargin = betsTotal > 0 ? (grossProfit / betsTotal) * 100 : 0;
    const netDeposits = depositsTotal - withdrawalsTotal;
    
    // Средний размер операций
    const avgDeposit = depositsCount > 0 ? depositsTotal / depositsCount : 0;
    const avgWithdrawal = withdrawalsCount > 0 ? withdrawalsTotal / withdrawalsCount : 0;
    const avgBet = betsCount > 0 ? betsTotal / betsCount : 0;
    const avgWin = winsCount > 0 ? winsTotal / winsCount : 0;
    
    // Формируем сообщение с результатами
    let message = `💰 *ФИНАНСОВЫЙ ОТЧЕТ* ${periodTitle}\n\n`;
    
    message += `📥 *Депозиты:*\n`;
    message += `• Сумма: ${depositsTotal} ⭐\n`;
    message += `• Количество: ${depositsCount}\n`;
    message += `• Средний: ${avgDeposit.toFixed(2)} ⭐\n\n`;
    
    message += `📤 *Выводы:*\n`;
    message += `• Сумма: ${withdrawalsTotal} ⭐\n`;
    message += `• Количество: ${withdrawalsCount}\n`;
    message += `• Средний: ${avgWithdrawal.toFixed(2)} ⭐\n\n`;
    
    message += `🎮 *Игровая активность:*\n`;
    message += `• Ставки: ${betsTotal} ⭐ (${betsCount} операций)\n`;
    message += `• Выигрыши: ${winsTotal} ⭐ (${winsCount} операций)\n`;
    message += `• Средняя ставка: ${avgBet.toFixed(2)} ⭐\n`;
    message += `• Средний выигрыш: ${avgWin.toFixed(2)} ⭐\n\n`;
    
    message += `⚖️ *Прибыль и потери:*\n`;
    message += `• Прибыль от игр: ${grossProfit} ⭐\n`;
    message += `• Маржа: ${profitMargin.toFixed(2)}%\n`;
    message += `• Чистый приток: ${netDeposits} ⭐\n`;
    message += `• Административные корректировки: ${adjustmentsTotal} ⭐ (${adjustmentsCount} операций)\n\n`;
    
    // Добавляем ключевые показатели эффективности
    message += `📊 *Ключевые показатели:*\n`;
    
    // RTP (Return To Player) - процент возврата игрокам
    const rtp = betsTotal > 0 ? (winsTotal / betsTotal) * 100 : 0;
    message += `• RTP: ${rtp.toFixed(2)}% (возврат игрокам)\n`;
    
    // Оборот - общая сумма ставок
    message += `• Оборот: ${betsTotal} ⭐\n`;
    
    // GGR (Gross Gaming Revenue) - валовый игровой доход
    message += `• GGR: ${grossProfit} ⭐ (валовый игровой доход)\n`;
    
    // NGR (Net Gaming Revenue) - чистый игровой доход с учетом бонусов/корректировок
    const ngr = grossProfit + adjustmentsTotal;
    message += `• NGR: ${ngr} ⭐ (чистый игровой доход)\n`;
    
    ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Income command error:', error);
    ctx.reply('Ошибка при анализе доходов.');
  }
});

// Команда для анализа активности игр
bot.command('games', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    
    // Параметры по умолчанию
    let period = 'all';
    let sortField = 'profit';
    let sortOrder = -1; // По умолчанию сортируем по убыванию (самые прибыльные первыми)
    
    // Парсинг параметров
    for (const arg of args.slice(1)) {
      if (['day', 'week', 'month', 'year', 'all'].includes(arg)) {
        period = arg;
      } else if (arg.startsWith('sort:')) {
        sortField = arg.replace('sort:', '');
        if (sortField.endsWith(':asc')) {
          sortField = sortField.replace(':asc', '');
          sortOrder = 1;
        }
      }
    }
    
    // Определяем временные рамки
    let dateFilter = {};
    let periodTitle = '';
    const now = new Date();
    
    if (period === 'day') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { $gte: startOfDay } };
      periodTitle = 'за сегодня';
    } else if (period === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: startOfWeek } };
      periodTitle = 'за неделю';
    } else if (period === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: startOfMonth } };
      periodTitle = 'за месяц';
    } else if (period === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = { createdAt: { $gte: startOfYear } };
      periodTitle = 'за год';
    } else {
      periodTitle = 'за все время';
    }
    
    // Получаем статистику по играм
    const gameStats = await GameHistory.aggregate([
      { $match: dateFilter },
      { 
        $group: { 
          _id: '$gameType', 
          count: { $sum: 1 },
          totalBet: { $sum: '$betAmount' },
          totalWin: { $sum: '$winAmount' },
          uniqueUsers: { $addToSet: '$telegramId' },
          wins: { $sum: { $cond: [{ $eq: ['$outcome', 'win'] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $eq: ['$outcome', 'lose'] }, 1, 0] } }
        }
      }
    ]);
    
    // Дополнительные расчеты и сортировка
    const enhancedStats = gameStats.map(game => {
      const profit = game.totalBet - game.totalWin;
      const profitMargin = game.totalBet > 0 ? (profit / game.totalBet) * 100 : 0;
      const winRate = game.count > 0 ? (game.wins / game.count) * 100 : 0;
      const uniqueCount = game.uniqueUsers ? game.uniqueUsers.length : 0;
      const avgBet = game.count > 0 ? game.totalBet / game.count : 0;
      
      return {
        gameType: game._id,
        count: game.count,
        totalBet: game.totalBet,
        totalWin: game.totalWin,
        profit,
        profitMargin,
        winRate,
        uniqueUsers: uniqueCount,
        avgBet,
        wins: game.wins,
        losses: game.losses
      };
    });
    
    // Сортировка результатов
    enhancedStats.sort((a, b) => {
      let valueA, valueB;
      
      // Выбираем поле для сортировки
      switch(sortField) {
        case 'count': valueA = a.count; valueB = b.count; break;
        case 'bets': valueA = a.totalBet; valueB = b.totalBet; break;
        case 'wins': valueA = a.totalWin; valueB = b.totalWin; break;
        case 'margin': valueA = a.profitMargin; valueB = b.profitMargin; break;
        case 'winrate': valueA = a.winRate; valueB = b.winRate; break;
        case 'players': valueA = a.uniqueUsers; valueB = b.uniqueUsers; break;
        case 'avgbet': valueA = a.avgBet; valueB = b.avgBet; break;
        default: valueA = a.profit; valueB = b.profit; // По умолчанию сортируем по прибыли
      }
      
      return (valueA - valueB) * sortOrder;
    });
    
    // Формируем сообщение
    let message = `🎮 *СТАТИСТИКА ИГР* ${periodTitle}\n\n`;
    
    if (enhancedStats.length === 0) {
      message += `⚠️ Нет данных за выбранный период.`;
    } else {
      // Общая статистика по всем играм
      const totalSessions = enhancedStats.reduce((sum, game) => sum + game.count, 0);
      const totalBets = enhancedStats.reduce((sum, game) => sum + game.totalBet, 0);
      const totalWins = enhancedStats.reduce((sum, game) => sum + game.totalWin, 0);
      const totalProfit = totalBets - totalWins;
      const overallMargin = totalBets > 0 ? (totalProfit / totalBets) * 100 : 0;
      
      message += `📊 *Общая статистика:*\n`;
      message += `• Количество игр: ${totalSessions}\n`;
      message += `• Общий объем ставок: ${totalBets} ⭐\n`;
      message += `• Общий объем выигрышей: ${totalWins} ⭐\n`;
      message += `• Общая прибыль: ${totalProfit} ⭐\n`;
      message += `• Средняя маржа: ${overallMargin.toFixed(2)}%\n\n`;
      
      message += `🎲 *Детализация по играм:*\n`;
      
      // Добавляем данные по каждой игре
      for (const game of enhancedStats) {
        message += `${getGameEmoji(game.gameType)} *${capitalizeFirstLetter(game.gameType)}*\n`;
        message += `• Сессии: ${game.count} (${((game.count / totalSessions) * 100).toFixed(1)}% от общего)\n`;
        message += `• Игроки: ${game.uniqueUsers}\n`;
        message += `• Ставки: ${game.totalBet} ⭐ | Выигрыши: ${game.totalWin} ⭐\n`;
        message += `• Прибыль: ${game.profit} ⭐ (маржа: ${game.profitMargin.toFixed(2)}%)\n`;
        message += `• Победы/поражения: ${game.wins}/${game.losses} (${game.winRate.toFixed(2)}%)\n`;
        message += `• Средняя ставка: ${game.avgBet.toFixed(2)} ⭐\n\n`;
      }
      
      // Рейтинг популярности и прибыльности
      message += `🏆 *Рейтинг игр:*\n`;
      
      // Сортируем по количеству сессий для определения популярности
      const popularityRanking = [...enhancedStats].sort((a, b) => b.count - a.count);
      message += `• По популярности: ${popularityRanking.slice(0, 3).map(g => capitalizeFirstLetter(g.gameType)).join(', ')}\n`;
      
      // Сортируем по прибыли
      const profitRanking = [...enhancedStats].sort((a, b) => b.profit - a.profit);
      message += `• По прибыли: ${profitRanking.slice(0, 3).map(g => capitalizeFirstLetter(g.gameType)).join(', ')}\n`;
      
      // Сортируем по марже
      const marginRanking = [...enhancedStats].sort((a, b) => b.profitMargin - a.profitMargin);
      message += `• По марже: ${marginRanking.slice(0, 3).map(g => capitalizeFirstLetter(g.gameType)).join(', ')}\n`;
    }
    
    ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Games analysis error:', error);
    ctx.reply('Ошибка при анализе статистики игр.');
  }
});

// Команда для получения списка лучших игроков
bot.command('topplayers', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    
    // Параметры по умолчанию
    let limit = 10; // По умолчанию 10 лучших игроков
    let metric = 'bets'; // По умолчанию сортируем по объему ставок
    let period = 'all'; // По умолчанию за все время
    
    // Парсинг параметров
    for (const arg of args.slice(1)) {
      if (!isNaN(parseInt(arg))) {
        limit = parseInt(arg);
      } else if (['bets', 'wins', 'profit', 'games', 'winrate', 'balance'].includes(arg)) {
        metric = arg;
      } else if (['day', 'week', 'month', 'year', 'all'].includes(arg)) {
        period = arg;
      }
    }
    
    // Определяем временные рамки
    let dateFilter = {};
    let periodTitle = '';
    const now = new Date();
    
    if (period === 'day') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { $gte: startOfDay } };
      periodTitle = 'за сегодня';
    } else if (period === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: startOfWeek } };
      periodTitle = 'за неделю';
    } else if (period === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: startOfMonth } };
      periodTitle = 'за месяц';
    } else if (period === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = { createdAt: { $gte: startOfYear } };
      periodTitle = 'за год';
    } else {
      periodTitle = 'за все время';
    }
    
    // Определяем метрику и формат для получения данных
    let topPlayers = [];
    let metricTitle = '';
    
    if (metric === 'balance') {
      // Если метрика - текущий баланс, используем простой запрос к пользователям
      metricTitle = 'по балансу';
      topPlayers = await User.find({ isBanned: false })
                           .sort({ balance: -1 })
                           .limit(limit);
      
      topPlayers = topPlayers.map(user => ({
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        value: user.balance,
        metric: 'balance'
      }));
    } else {
      // Для других метрик используем агрегацию
      
      switch(metric) {
        case 'bets':
          metricTitle = 'по объему ставок';
          // Агрегация по сумме ставок
          const betsAgg = await Transaction.aggregate([
            { $match: { ...dateFilter, type: 'bet' } },
            { $group: { 
              _id: '$telegramId', 
              total: { $sum: { $abs: '$amount' } },
              count: { $sum: 1 }
            }},
            { $sort: { total: -1 } },
            { $limit: limit }
          ]);
          
          // Получаем данные пользователей
          for (const player of betsAgg) {
            const user = await User.findOne({ telegramId: player._id });
            if (user) {
              topPlayers.push({
                telegramId: user.telegramId,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                value: player.total,
                count: player.count,
                metric: 'bets'
              });
            }
          }
          break;
          
        case 'wins':
          metricTitle = 'по выигрышам';
          // Агрегация по сумме выигрышей
          const winsAgg = await Transaction.aggregate([
            { $match: { ...dateFilter, type: 'win' } },
            { $group: { 
              _id: '$telegramId', 
              total: { $sum: '$amount' },
              count: { $sum: 1 }
            }},
            { $sort: { total: -1 } },
            { $limit: limit }
          ]);
          
          // Получаем данные пользователей
          for (const player of winsAgg) {
            const user = await User.findOne({ telegramId: player._id });
            if (user) {
              topPlayers.push({
                telegramId: user.telegramId,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                value: player.total,
                count: player.count,
                metric: 'wins'
              });
            }
          }
          break;
          
        case 'games':
          metricTitle = 'по количеству игр';
          // Агрегация по количеству игр
          const gamesAgg = await GameHistory.aggregate([
            { $match: dateFilter },
            { $group: { 
              _id: '$telegramId', 
              count: { $sum: 1 }
            }},
            { $sort: { count: -1 } },
            { $limit: limit }
          ]);
          
          // Получаем данные пользователей
          for (const player of gamesAgg) {
            const user = await User.findOne({ telegramId: player._id });
            if (user) {
              topPlayers.push({
                telegramId: user.telegramId,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                value: player.count,
                metric: 'games'
              });
            }
          }
          break;
          
        case 'profit':
          metricTitle = 'по прибыли казино';
          // Получаем данные по ставкам и выигрышам для каждого пользователя
          const allUsers = await User.find({});
          const profitData = [];
          
          for (const user of allUsers) {
            // Получаем сумму ставок
            const bets = await Transaction.aggregate([
              { $match: { ...dateFilter, telegramId: user.telegramId, type: 'bet' } },
              { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
            ]);
            
            // Получаем сумму выигрышей
            const wins = await Transaction.aggregate([
              { $match: { ...dateFilter, telegramId: user.telegramId, type: 'win' } },
              { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            
            const betsTotal = bets[0]?.total || 0;
            const winsTotal = wins[0]?.total || 0;
            const profit = betsTotal - winsTotal;
            
            profitData.push({
              telegramId: user.telegramId,
              firstName: user.firstName,
              lastName: user.lastName,
              username: user.username,
              value: profit,
              bets: betsTotal,
              wins: winsTotal,
              metric: 'profit'
            });
          }
          
          // Сортируем по прибыли и ограничиваем количество
          profitData.sort((a, b) => b.value - a.value);
          topPlayers = profitData.slice(0, limit);
          break;
          
        case 'winrate':
          metricTitle = 'по проценту побед';
          // Получаем статистику игр для каждого пользователя
          const allGameUsers = await User.find({});
          const winrateData = [];
          
          for (const user of allGameUsers) {
            // Получаем статистику игр
            const games = await GameHistory.aggregate([
              { $match: { ...dateFilter, telegramId: user.telegramId } },
              { $group: { 
                _id: null, 
                total: { $sum: 1 },
                wins: { $sum: { $cond: [{ $eq: ['$outcome', 'win'] }, 1, 0] } }
              }}
            ]);
            
            if (games.length > 0 && games[0].total >= 10) { // Минимум 10 игр для статистики
              const total = games[0].total;
              const wins = games[0].wins;
              const winrate = (wins / total) * 100;
              
              winrateData.push({
                telegramId: user.telegramId,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                value: winrate,
                games: total,
                wins: wins,
                metric: 'winrate'
              });
            }
          }
          
          // Сортируем по проценту побед и ограничиваем количество
          winrateData.sort((a, b) => b.value - a.value);
          topPlayers = winrateData.slice(0, limit);
          break;
      }
    }
    
    // Формируем сообщение
    let message = `🏆 *ТОП ${limit} ИГРОКОВ* ${metricTitle} ${periodTitle}\n\n`;
    
    if (topPlayers.length === 0) {
      message += `⚠️ Нет данных за выбранный период.`;
    } else {
      for (let i = 0; i < topPlayers.length; i++) {
        const player = topPlayers[i];
        const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i+1}.`));
        
        message += `${medal} ${player.firstName} ${player.lastName || ''}\n`;
        message += `🆔 ID: ${player.telegramId}\n`;
        
        // Выводим значение в зависимости от метрики
        switch(player.metric) {
          case 'balance':
            message += `💰 Баланс: ${player.value} ⭐\n`;
            break;
          case 'bets':
            message += `🎮 Ставки: ${player.value} ⭐ (${player.count} операций)\n`;
            break;
          case 'wins':
            message += `🏆 Выигрыши: ${player.value} ⭐ (${player.count} операций)\n`;
            break;
          case 'games':
            message += `🎲 Игр: ${player.value}\n`;
            break;
          case 'profit':
            message += `💸 Прибыль казино: ${player.value} ⭐\n`;
            message += `   (Ставки: ${player.bets} ⭐ | Выигрыши: ${player.wins} ⭐)\n`;
            break;
          case 'winrate':
            message += `🎯 Процент побед: ${player.value.toFixed(2)}%\n`;
            message += `   (Игр: ${player.games} | Побед: ${player.wins})\n`;
            break;
        }
        
        message += `\n`;
      }
    }
    
    ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Topplayers command error:', error);
    ctx.reply('Ошибка при формировании рейтинга игроков.');
  }
});

// Ежедневный отчет
bot.command('dailyreport', async (ctx) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateFilter = { createdAt: { $gte: startOfDay } };
    
    // Форматированная дата
    const formattedDate = startOfDay.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    
    // Получаем основные показатели
    const [
      newUsers,
      activeUsers,
      deposits,
      withdrawals,
      bets,
      wins,
      games
    ] = await Promise.all([
      // Новые пользователи
      User.countDocuments({ ...dateFilter }),
      
      // Активные пользователи (сделавшие хотя бы одну ставку)
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'bet' } },
        { $group: { _id: '$telegramId' } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]),
      
      // Депозиты
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'deposit' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      
      // Выводы
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'withdrawal' } },
        { $group: { _id: null, total: { $sum: { $abs: '$amount' } }, count: { $sum: 1 } } }
      ]),
      
      // Ставки
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'bet' } },
        { $group: { _id: null, total: { $sum: { $abs: '$amount' } }, count: { $sum: 1 } } }
      ]),
      
      // Выигрыши
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'win' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      
      // Статистика по играм
      GameHistory.aggregate([
        { $match: dateFilter },
        { $group: { 
          _id: '$gameType', 
          count: { $sum: 1 },
          totalBet: { $sum: '$betAmount' },
          totalWin: { $sum: '$winAmount' }
        }}
      ])
    ]);
    
    // Расчет ключевых показателей
    const activeCount = activeUsers[0]?.count || 0;
    
    const depositsTotal = deposits[0]?.total || 0;
    const depositsCount = deposits[0]?.count || 0;
    
    const withdrawalsTotal = withdrawals[0]?.total || 0;
    const withdrawalsCount = withdrawals[0]?.count || 0;
    
    const betsTotal = bets[0]?.total || 0;
    const betsCount = bets[0]?.count || 0;
    
    const winsTotal = wins[0]?.total || 0;
    const winsCount = wins[0]?.count || 0;
    
    const profit = betsTotal - winsTotal;
    const profitMargin = betsTotal > 0 ? (profit / betsTotal) * 100 : 0;
    
    // Сортировка игр по прибыли
    const sortedGames = games.map(game => {
      return {
        gameType: game._id,
        count: game.count,
        totalBet: game.totalBet,
        totalWin: game.totalWin,
        profit: game.totalBet - game.totalWin
      };
    }).sort((a, b) => b.profit - a.profit);
    
    // Формируем сообщение отчета
    let message = `📅 *ЕЖЕДНЕВНЫЙ ОТЧЕТ* за ${formattedDate}\n\n`;
    
    message += `👥 *Пользователи:*\n`;
    message += `• Новых регистраций: ${newUsers}\n`;
    message += `• Активных игроков: ${activeCount}\n\n`;
    
    message += `💰 *Финансы:*\n`;
    message += `• Депозиты: ${depositsTotal} ⭐ (${depositsCount} операций)\n`;
    message += `• Выводы: ${withdrawalsTotal} ⭐ (${withdrawalsCount} операций)\n`;
    message += `• Ставки: ${betsTotal} ⭐ (${betsCount} операций)\n`;
    message += `• Выигрыши: ${winsTotal} ⭐ (${winsCount} операций)\n`;
    message += `• Прибыль: ${profit} ⭐ (${profitMargin.toFixed(2)}%)\n\n`;
    
    message += `🎮 *Игры:*\n`;
    for (const game of sortedGames) {
      const gameProfit = game.totalBet - game.totalWin;
      const gameMargin = game.totalBet > 0 ? (gameProfit / game.totalBet) * 100 : 0;
      
      message += `${getGameEmoji(game.gameType)} ${capitalizeFirstLetter(game.gameType)}: ${game.count} игр\n`;
      message += `   Прибыль: ${gameProfit} ⭐ (${gameMargin.toFixed(2)}%)\n`;
    }
    
    message += `\n📈 *Лучшие показатели дня:*\n`;
    
    // Лучшие показатели дня
    if (sortedGames.length > 0) {
      message += `• Самая прибыльная игра: ${capitalizeFirstLetter(sortedGames[0].gameType)}\n`;
    }
    
    // Игрок с наибольшим числом игр
    const topPlayerByGames = await GameHistory.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$telegramId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    
    if (topPlayerByGames.length > 0) {
      const topPlayer = await User.findOne({ telegramId: topPlayerByGames[0]._id });
      if (topPlayer) {
        message += `• Самый активный игрок: ${topPlayer.firstName} (ID: ${topPlayer.telegramId}) - ${topPlayerByGames[0].count} игр\n`;
      }
    }
    
    // Игрок с наибольшим выигрышем
    const topPlayerByWins = await Transaction.aggregate([
      { $match: { ...dateFilter, type: 'win' } },
      { $group: { _id: '$telegramId', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 1 }
    ]);
    
    if (topPlayerByWins.length > 0) {
      const topWinner = await User.findOne({ telegramId: topPlayerByWins[0]._id });
      if (topWinner) {
        message += `• Крупнейший выигрыш: ${topWinner.firstName} (ID: ${topWinner.telegramId}) - ${topPlayerByWins[0].total} ⭐\n`;
      }
    }
    
    ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Daily report error:', error);
    ctx.reply('Ошибка при формировании ежедневного отчета.');
  }
});

// Недельный отчет
bot.command('weeklyreport', async (ctx) => {
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const dateFilter = { createdAt: { $gte: startOfWeek } };
    
    // Форматированные даты
    const startDate = startOfWeek.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    
    const endDate = new Date().toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    
    // Здесь можно использовать ту же логику, что и в ежедневном отчете,
    // но с другим dateFilter и дополнительной аналитикой по дням недели
    
    const [
      newUsers,
      activeUsers,
      deposits,
      withdrawals,
      bets,
      wins,
      games,
      dailyStats
    ] = await Promise.all([
      // Статистика аналогичная ежедневному отчету
      User.countDocuments({ ...dateFilter }),
      
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'bet' } },
        { $group: { _id: '$telegramId' } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]),
      
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'deposit' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'withdrawal' } },
        { $group: { _id: null, total: { $sum: { $abs: '$amount' } }, count: { $sum: 1 } } }
      ]),
      
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'bet' } },
        { $group: { _id: null, total: { $sum: { $abs: '$amount' } }, count: { $sum: 1 } } }
      ]),
      
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'win' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      
      GameHistory.aggregate([
        { $match: dateFilter },
        { $group: { 
          _id: '$gameType', 
          count: { $sum: 1 },
          totalBet: { $sum: '$betAmount' },
          totalWin: { $sum: '$winAmount' }
        }}
      ]),
      
      // Дополнительно - статистика по дням недели
      Transaction.aggregate([
        { $match: { ...dateFilter, type: { $in: ['bet', 'win'] } } },
        {
          $group: {
            _id: {
              day: { $dayOfWeek: '$createdAt' },
              type: '$type'
            },
            total: { $sum: { $cond: [{ $eq: ['$type', 'bet'] }, { $abs: '$amount' }, '$amount'] } },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.day': 1 } }
      ])
    ]);
    
    // Расчеты и форматирование аналогичны ежедневному отчету
    // Формируем статистику по дням недели
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const dayStats = {};
    
    // Инициализируем статистику для каждого дня
    for (let i = 0; i < 7; i++) {
      dayStats[i+1] = { bets: 0, wins: 0, profit: 0, count: 0 };
    }
    
    // Заполняем статистику по дням
    for (const stat of dailyStats) {
      const day = stat._id.day;
      const type = stat._id.type;
      
      if (type === 'bet') {
        dayStats[day].bets = stat.total;
        dayStats[day].count = stat.count;
      } else if (type === 'win') {
        dayStats[day].wins = stat.total;
      }
    }
    
    // Расчет прибыли по дням
    for (const day in dayStats) {
      dayStats[day].profit = dayStats[day].bets - dayStats[day].wins;
    }
    
    // Остальные расчеты и формирование сообщения
    
    // ...

    // Формируем отчет
    let message = `📊 *ЕЖЕНЕДЕЛЬНЫЙ ОТЧЕТ* (${startDate} - ${endDate})\n\n`;
    
    // Аналогично ежедневному отчету, добавляем основные показатели
    const activeCount = activeUsers[0]?.count || 0;
    
    const depositsTotal = deposits[0]?.total || 0;
    const depositsCount = deposits[0]?.count || 0;
    
    const withdrawalsTotal = withdrawals[0]?.total || 0;
    const withdrawalsCount = withdrawals[0]?.count || 0;
    
    const betsTotal = bets[0]?.total || 0;
    const betsCount = bets[0]?.count || 0;
    
    const winsTotal = wins[0]?.total || 0;
    const winsCount = wins[0]?.count || 0;
    
    const profit = betsTotal - winsTotal;
    const profitMargin = betsTotal > 0 ? (profit / betsTotal) * 100 : 0;
    
    message += `👥 *Пользователи:*\n`;
    message += `• Новых регистраций: ${newUsers}\n`;
    message += `• Активных игроков: ${activeCount}\n\n`;
    
    message += `💰 *Финансы:*\n`;
    message += `• Депозиты: ${depositsTotal} ⭐ (${depositsCount} операций)\n`;
    message += `• Выводы: ${withdrawalsTotal} ⭐ (${withdrawalsCount} операций)\n`;
    message += `• Ставки: ${betsTotal} ⭐ (${betsCount} операций)\n`;
    message += `• Выигрыши: ${winsTotal} ⭐ (${winsCount} операций)\n`;
    message += `• Прибыль: ${profit} ⭐ (${profitMargin.toFixed(2)}%)\n\n`;
    
    // Добавляем статистику по дням недели
    message += `📅 *Статистика по дням недели:*\n`;
    
    // Находим самый прибыльный и убыточный день
    let bestDay = null;
    let worstDay = null;
    let bestProfit = -Infinity;
    let worstProfit = Infinity;
    
    for (const day in dayStats) {
      const profit = dayStats[day].profit;
      
      if (dayStats[day].count > 0) { // Только если были игры в этот день
        if (profit > bestProfit) {
          bestProfit = profit;
          bestDay = day;
        }
        
        if (profit < worstProfit) {
          worstProfit = profit;
          worstDay = day;
        }
      }
      
      // Добавляем день в отчет
      if (dayStats[day].count > 0) {
        const profitMargin = dayStats[day].bets > 0 ? (dayStats[day].profit / dayStats[day].bets) * 100 : 0;
        message += `• ${dayNames[parseInt(day)-1]}: ${dayStats[day].profit} ⭐ (${profitMargin.toFixed(2)}%)\n`;
      }
    }
    
    // Добавляем лучший и худший день
    if (bestDay !== null) {
      message += `\n🔝 Самый прибыльный день: ${dayNames[parseInt(bestDay)-1]} (${bestProfit} ⭐)\n`;
    }
    
    if (worstDay !== null && worstProfit < 0) {
      message += `📉 Самый убыточный день: ${dayNames[parseInt(worstDay)-1]} (${worstProfit} ⭐)\n`;
    }
    
    ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Weekly report error:', error);
    ctx.reply('Ошибка при формировании еженедельного отчета.');
  }
});

// Вспомогательные функции
function getGameEmoji(gameType) {
  switch(gameType) {
    case 'slots': return '🎰';
    case 'roulette': return '🎲';
    case 'guessnumber': return '🔢';
    case 'miner': return '💣';
    case 'crush': return '📈';
    case 'dispute': return '🏆';
    default: return '🎮';
  }
}

function getTransactionTypeEmoji(txType) {
  switch(txType) {
    case 'deposit': return '📥';
    case 'withdrawal': return '📤';
    case 'bet': return '🎮';
    case 'win': return '🏆';
    case 'admin_adjustment': return '⚙️';
    default: return '💼';
  }
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

return bot;
};