const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.issues[0].message;
    return res.status(400).json({ message });
  }
  req.body = result.data; // replace with Zod-parsed (coerced/trimmed) values
  next();
};

module.exports = validate;
