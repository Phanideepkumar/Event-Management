function errorHandler(err, req, res, _next) {
  console.error('[EventDesk Error]:', err.stack || err.message || err);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode);

  res.format({
    'text/html': () => {
      res.render('error', {
        title: `Error ${statusCode}`,
        status: statusCode,
        message: message,
        error: process.env.NODE_ENV === 'development' ? err : {}
      });
    },
    'application/json': () => {
      res.json({
        error: message,
        status: statusCode,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    },
    'default': () => {
      res.type('txt').send(`Error ${statusCode}: ${message}`);
    }
  });
}

module.exports = errorHandler;
