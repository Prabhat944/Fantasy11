// e.g., in utils/timeHelpers.js
function getCountdown(dateTimeGMT) {
  const now = new Date();
  const matchTime = new Date(dateTimeGMT);
  let diff = matchTime - now;

  if (diff < 0) { // Match is in the past
      diff = Math.abs(diff);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days > 0) return `${days}d ago`;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours > 0) return `${hours}h ago`;
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
  } else { // Match is in the future
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      diff -= days * (1000 * 60 * 60 * 24);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      diff -= hours * (1000 * 60 * 60);
      const minutes = Math.floor(diff / (1000 * 60));

      if (days > 0) return `${days}d ${hours}h left`;
      if (hours > 0) return `${hours}h ${minutes}m left`;
      return `${minutes}m left`;
  }
}

module.exports= getCountdown;