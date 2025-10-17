/**
 * Badge criteria and names
 */
const BADGES = {
  FIRST_REPORTER: {
    name: 'First Reporter',
    check: (user) => user.issues_reported >= 1
  },
  TOP_REPORTER: {
    name: 'Top Reporter',
    check: (user) => user.issues_reported >= 10
  },
  CIVIC_HERO: {
    name: 'Civic Hero',
    check: (user) => user.issues_reported >= 50
  },
  VERIFIER: {
    name: 'Verifier',
    check: (user) => user.verifications_done >= 10
  },
  TRUSTED_VOICE: {
    name: 'Trusted Voice',
    check: (user) => user.rep >= 200
  }
};

/**
 * Check and update user badges based on their stats
 * @param {Object} user - User object with stats
 * @returns {Array<string>} Updated badges array
 */
function updateBadges(user) {
  const currentBadges = user.badges || [];
  const newBadges = [...currentBadges];
  
  for (const [key, badge] of Object.entries(BADGES)) {
    if (badge.check(user) && !newBadges.includes(badge.name)) {
      newBadges.push(badge.name);
    }
  }
  
  return newBadges;
}

/**
 * Reputation changes for different actions
 */
const REPUTATION_CHANGES = {
  UPVOTE_RECEIVED: 5,
  DOWNVOTE_RECEIVED: -3,
  ISSUE_VERIFIED: 10,
  VERIFICATION_DONE: 5,
  MARKED_SPAM: -20
};

/**
 * Calculate new reputation (minimum 0)
 * @param {number} currentRep - Current reputation
 * @param {number} change - Reputation change amount
 * @returns {number} New reputation (min 0)
 */
function calculateNewReputation(currentRep, change) {
  return Math.max(0, currentRep + change);
}

module.exports = {
  BADGES,
  updateBadges,
  REPUTATION_CHANGES,
  calculateNewReputation
};
