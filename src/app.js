
/**
* Module dependencies.
*/

const express = require('express');
const compression = require('compression');
const session = require('express-session');
const bodyParser = require('body-parser');
const logger = require('morgan');
const chalk = require('chalk');
const errorHandler = require('errorhandler');
const lusca = require('lusca');
const dotenv = require('dotenv');
const MongoStore = require('connect-mongo')(session);
const flash = require('express-flash');
const path = require('path');
const mongoose = require('mongoose');
const passport = require('passport');
const expressValidator = require('express-validator');
const expressStatusMonitor = require('express-status-monitor');
const nunjucks = require('nunjucks');
const favicon = require('serve-favicon');

const nunjucksDate = require('nunjucks-date');

const { DB_URL } = require('./config/env.js');


/**
* Load environment variables from .env file, where API keys and passwords are configured.
*/
dotenv.load({ path: '.env' });

/**
* Controllers (route handlers).
*/
const homeController = require('./controller/home');
const userController = require('./controller/user');

/**
* API keys and Passport configuration.
*/
const passportConfig = require('./config/passport');

/**
* Create Express server.
*/
const app = express();

/**
* Connect to MongoDB.
*/
mongoose.connect(DB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.connection.on('error', (err) => {
  console.error(err);
  console.log('%s MongoDB connection error. Please make sure MongoDB is running.', chalk.red('✗'));
  process.exit();
});

/**
* Express configuration.
*/

// view engine setup

const env = nunjucks.configure(path.join(__dirname, 'views'), { autoescape: true, express: app, watch: true });

nunjucksDate.setDefaultFormat('Do MMMM  YYYY, h:mm:ss a');
env.addFilter('date', nunjucksDate);

app.set('port', 3000);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));

app.use(expressStatusMonitor());
app.use(compression());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET,
  cookie: { maxAge: 1209600000 }, // two weeks in milliseconds
  store: new MongoStore({
    mongooseConnection: mongoose.connection,
    autoReconnect: true,
    clear_interval: 3600
  })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
  if (req.path === '/api/upload') {
    next();
  } else {
    lusca.csrf()(req, res, next);
  }
});
app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});
app.use((req, res, next) => {
  // After successful login, redirect back to the intended page
  if (!req.user
   && req.path !== '/login'
   && req.path !== '/signup'
   && !req.path.match(/^\/auth/)
   && !req.path.match(/\./)) {
    req.session.returnTo = req.originalUrl;
  } else if (req.user
   && (req.path === '/account' || req.path.match(/^\/api/))) {
    req.session.returnTo = req.originalUrl;
  }

  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));

/**
* Primary app routes.
*/
app.get('/', homeController.index);
app.get('/boxoffice', userController.getLogin);
app.post('/login', userController.postLogin);
app.get('/logout', userController.logout);
app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);
app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);
app.get('/signup', userController.getSignup);
app.post('/signup', userController.postSignup);
app.get('/account', passportConfig.isAuthenticated, userController.getAccount);
app.post('/account/profile', passportConfig.isAuthenticated, userController.postUpdateProfile);
app.post('/account/password', passportConfig.isAuthenticated, userController.postUpdatePassword);
app.post('/account/delete', passportConfig.isAuthenticated, userController.postDeleteAccount);
app.get('/account/unlink/:provider', passportConfig.isAuthenticated, userController.getOauthUnlink);

/**
* API examples routes.
*/
// app.get('/api', apiController.getApi);
// app.get('/api/lob', apiController.getLob);
// app.get('/api/upload', apiController.getFileUpload);
// app.post('/api/upload', upload.single('myFile'), apiController.postFileUpload);
// app.get('/api/google-maps', apiController.getGoogleMaps);

/**
* Error Handler.
*/
app.use(errorHandler());

/**
* Start Express server.
*/
app.listen(app.get('port'), () => {
  console.log('%s App is running at http://localhost:%d in %s mode', chalk.green('✓'), app.get('port'), app.get('env'));
  console.log('  Press CTRL-C to stop\n');
});

module.exports = app;
