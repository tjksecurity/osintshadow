/**
 * Helper functions for generating realistic content
 */

export function generateRealisticTweet(username, index) {
  const tweets = [
    `Just finished an amazing project! #productivity #success`,
    `Great meeting with the team today. Looking forward to what's next!`,
    `Thoughts on the latest tech trends? What do you think?`,
    `Beautiful sunset today. Sometimes you need to pause and appreciate life.`,
    `Working on something exciting. Can't wait to share more details soon!`,
  ];
  return tweets[index % tweets.length];
}

export function generateRealisticInstagramCaption(username, index) {
  const captions = [
    `Living my best life ✨ #blessed #happy #lifestyle`,
    `Amazing day with friends! Love these moments 📸`,
    `New adventure begins today! So excited 🌟 #adventure`,
    `Perfect weather for exploring the city 🌞 #explore`,
    `Grateful for all the support! Thank you everyone ❤️`,
  ];
  return captions[index % captions.length];
}

export function generateRealisticLinkedInPost(username, index) {
  const posts = [
    `Excited to announce my new role as Senior Developer. Looking forward to the challenges ahead! #career #technology`,
    `Just completed a certification in data science. Continuous learning is key to growth. #learning #datascience`,
    `Attended an excellent conference on AI and machine learning. The future is bright! #AI #innovation`,
    `Proud to be part of a team that delivered a successful product launch. Teamwork makes the dream work! #teamwork`,
    `Reflecting on the importance of work-life balance in today's fast-paced world. #worklife #balance`,
  ];
  return posts[index % posts.length];
}

export function generateRealisticTikTokCaption(username, index) {
  const captions = [
    `When you finally figure out that coding bug 😅 #coding #programmer`,
    `POV: You're trying to explain your job to your parents 🤣`,
    `This trend but make it tech 💻 #techtok`,
    `Day in the life of a software developer ⚡ #dayinthelife`,
    `That feeling when your code works on the first try ✨ #coding`,
  ];
  return captions[index % captions.length];
}

export function generateRealisticRedditPost(username, index) {
  const posts = [
    `Does anyone else think that AI is advancing too quickly? What are your thoughts?`,
    `LPT: Always backup your code. Learned this the hard way today.`,
    `TIL that there are more possible games of chess than atoms in the observable universe.`,
    `What's your opinion on remote work vs office work in 2024?`,
    `ELI5: How does machine learning actually work behind the scenes?`,
  ];
  return posts[index % posts.length];
}

export function generateInstagramHashtags() {
  const hashtags = [
    "life",
    "happy",
    "blessed",
    "love",
    "friends",
    "adventure",
    "explore",
    "nature",
    "photography",
    "lifestyle",
  ];
  return hashtags.slice(0, Math.floor(Math.random() * 5) + 3);
}

export function generateLinkedInHashtags() {
  const hashtags = [
    "career",
    "technology",
    "innovation",
    "leadership",
    "growth",
    "learning",
    "professional",
    "networking",
  ];
  return hashtags.slice(0, Math.floor(Math.random() * 3) + 2);
}

export function generateTikTokHashtags() {
  const hashtags = [
    "fyp",
    "viral",
    "trending",
    "techtok",
    "programmer",
    "coding",
    "dayinthelife",
    "funny",
  ];
  return hashtags.slice(0, Math.floor(Math.random() * 4) + 3);
}
