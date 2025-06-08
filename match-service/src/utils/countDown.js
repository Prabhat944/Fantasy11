function getCountdown(matchTime, type = 'future') {
    if (!matchTime) return null;
  
    const now = new Date();
    const matchDate = new Date(matchTime + 'Z'); // Enforce UTC parsing
  
    if (isNaN(matchDate.getTime())) {
      return null; // Invalid date
    }
  
    let diff = matchDate - now;
  
    if (type === 'past') {
      diff = now - matchDate;
      if (diff <= 0) return "Just now";
    } else {
      if (diff <= 0) return "Match started";
    }
  
    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
    if (type === 'past') {
      return `${days}d ${hours}h ${minutes}m ago`;
    } else {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
  }
  
  module.exports = getCountdown;
  