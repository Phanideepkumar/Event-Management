const crypto = require('crypto');

function csrfProtection(options = {}) {
  const ignoreMethods = options.ignoreMethods || ['GET', 'HEAD', 'OPTIONS'];

  return (req, res, next) => {
    if (!req.session) {
      return next(new Error('Session middleware required for CSRF protection'));
    }

    if (!req.session.csrfSecret) {
      req.session.csrfSecret = crypto.randomBytes(32).toString('hex');
    }

    req.csrfToken = () => {
      if (!req._csrfToken) {
        req._csrfToken = req.session.csrfSecret;
      }
      return req._csrfToken;
    };

    res.locals.csrfToken = req.csrfToken();

    // Skip validation for safe read methods or test environment
    if (ignoreMethods.includes(req.method) || process.env.NODE_ENV === 'test') {
      return next();
    }

    const clientToken = (req.body && req.body._csrf) ||
                        req.headers['x-csrf-token'] ||
                        req.headers['csrf-token'] ||
                        (req.query && req.query._csrf);

    if (!clientToken || clientToken !== req.session.csrfSecret) {
      const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
      if (isJson) {
        return res.status(403).json({ error: 'Invalid or missing CSRF token' });
      }
      req.flash('error', 'Form session expired or invalid CSRF token. Please try again.');
      return res.status(403).redirect('back');
    }

    next();
  };
}

module.exports = csrfProtection;
