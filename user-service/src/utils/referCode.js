const generateReferCode = (name = '') => {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${name?.substring(0, 3).toUpperCase() || 'USR'}${random}`;
  };
  
    module.exports = generateReferCode;