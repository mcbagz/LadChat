// LadChat Personality System - Making every word count 🔥
export interface LadCopyVariant {
  text: string;
  mood?: 'casual' | 'hype' | 'chill' | 'epic';
  context?: string;
}

export class LadCopy {
  private static getRandomVariant(variants: LadCopyVariant[]): string {
    const randomIndex = Math.floor(Math.random() * variants.length);
    return variants[randomIndex].text;
  }

  // Camera & Content Creation
  static readonly CAMERA = {
    STORY_MODE: () => this.getRandomVariant([
      { text: "Drop something epic for the crew 🔥", mood: 'hype' },
      { text: "Show the lads what you're up to", mood: 'casual' },
      { text: "Time to flex on the timeline", mood: 'epic' }
    ]),
    
    SNAP_MODE: () => this.getRandomVariant([
      { text: "Send it to the boys 📸", mood: 'casual' },
      { text: "Quick snap to your lads", mood: 'chill' },
      { text: "Fire off a quick one", mood: 'hype' }
    ]),
    
    RECORDING: () => this.getRandomVariant([
      { text: "Keep holding, legend!", mood: 'hype' },
      { text: "This is gonna be sick 🎥", mood: 'epic' },
      { text: "The boys are gonna love this", mood: 'casual' }
    ]),
    
    PHOTO_TAKEN: () => this.getRandomVariant([
      { text: "Absolute banger! 📸", mood: 'hype' },
      { text: "Clean shot, bro!", mood: 'epic' },
      { text: "That's what I'm talking about!", mood: 'hype' }
    ])
  };

  // Friends & Social
  static readonly FRIENDS = {
    NO_FRIENDS: () => this.getRandomVariant([
      { text: "Time to build your squad, king 👑", mood: 'hype' },
      { text: "Every legend needs their crew", mood: 'epic' },
      { text: "Let's get the gang together", mood: 'casual' }
    ]),
    
    FRIEND_REQUEST_SENT: () => this.getRandomVariant([
      { text: "Sent! Now we wait... 🤞", mood: 'casual' },
      { text: "Request fired! Fingers crossed", mood: 'hype' },
      { text: "Sliding into their friend requests", mood: 'chill' }
    ]),
    
    NEW_FRIEND: (username: string) => this.getRandomVariant([
      { text: `Welcome to the crew, ${username}! 🎉`, mood: 'hype' },
      { text: `${username} is officially one of the lads!`, mood: 'epic' },
      { text: `Squad just got stronger with ${username}`, mood: 'casual' }
    ]),

    FRIEND_REQUEST_MESSAGE: (username: string) => this.getRandomVariant([
      { text: `Hey ${username}, let's connect and build the squad!`, mood: 'casual' },
      { text: `${username}, you seem like one of the lads - let's be friends!`, mood: 'hype' },
      { text: `Yo ${username}, let's add each other to the crew`, mood: 'chill' }
    ]),
    
    SEARCH_PLACEHOLDER: () => this.getRandomVariant([
      { text: "Find your people...", mood: 'casual' },
      { text: "Search for lads...", mood: 'chill' },
      { text: "Who we adding to the crew?", mood: 'hype' }
    ])
  };

  // Events & Hangouts
  static readonly EVENTS = {
    NO_EVENTS: () => this.getRandomVariant([
      { text: "Nothing epic planned yet", mood: 'casual' },
      { text: "Time to make something legendary happen", mood: 'epic' },
      { text: "The calendar's looking pretty sad, ngl", mood: 'chill' }
    ]),
    
    CREATE_EVENT: () => this.getRandomVariant([
      { text: "Plan something legendary", mood: 'epic' },
      { text: "Get the lads together", mood: 'casual' },
      { text: "Time to organize some chaos", mood: 'hype' }
    ]),
    
    EVENT_CREATED: () => this.getRandomVariant([
      { text: "Event is LIVE! 🔥 Time to get hype", mood: 'hype' },
      { text: "Absolute legend! The boys are gonna love this", mood: 'epic' },
      { text: "And just like that, weekend plans sorted ✨", mood: 'casual' }
    ]),
    
    RSVP_YES: () => this.getRandomVariant([
      { text: "Let's gooo! 🚀", mood: 'hype' },
      { text: "Count me in, legends!", mood: 'epic' },
      { text: "Wouldn't miss it for the world", mood: 'casual' }
    ]),
    
    LIVE_EVENT: () => this.getRandomVariant([
      { text: "Happening NOW! 🔴", mood: 'hype' },
      { text: "The lads are gathering LIVE", mood: 'epic' },
      { text: "It's going down right now", mood: 'casual' }
    ]),
    
    JOIN_EVENT: () => this.getRandomVariant([
      { text: "Join the crew", mood: 'casual' },
      { text: "Get in there, legend!", mood: 'hype' },
      { text: "Don't miss out", mood: 'epic' }
    ])
  };

  // Hangouts/Events
  static readonly HANGOUTS = {
    AI_RECOMMENDATIONS: () => this.getRandomVariant([
      { text: "AI Event Ideas", mood: 'casual' },
      { text: "Smart Suggestions", mood: 'epic' },
      { text: "AI-Powered Plans", mood: 'hype' }
    ]),
    
    GENERATE: () => "Get AI Recommendation",
    
    EVENT_CREATED: () => this.getRandomVariant([
      { text: "Event created! Time to gather the squad 🎉", mood: 'hype' },
      { text: "Your event is live - let's make it legendary!", mood: 'epic' },
      { text: "Event is ready! Now spread the word", mood: 'casual' }
    ])
  };

  // Messages & Chat
  static readonly MESSAGES = {
    NO_MESSAGES: () => this.getRandomVariant([
      { text: "Slide into those DMs, king", mood: 'hype' },
      { text: "Time to break the ice", mood: 'casual' },
      { text: "These messages aren't gonna send themselves", mood: 'chill' }
    ]),
    
    MESSAGE_PLACEHOLDER: () => this.getRandomVariant([
      { text: "Say something legendary...", mood: 'epic' },
      { text: "Drop a line...", mood: 'casual' },
      { text: "What's good?", mood: 'chill' }
    ]),
    
    MEDIA_EXPIRED: () => this.getRandomVariant([
      { text: "Gone like it never happened 👻", mood: 'chill' },
      { text: "Poof! Into the void", mood: 'casual' },
      { text: "That was a one-time show", mood: 'epic' }
    ])
  };

  // Stories
  static readonly STORIES = {
    TIMELINE_SUBTITLE: () => this.getRandomVariant([
      { text: "What the crew is up to", mood: 'casual' },
      { text: "See what your lads are doing", mood: 'chill' },
      { text: "The latest from your circle", mood: 'casual' }
    ]),
    
    NO_STORIES: () => this.getRandomVariant([
      { text: "Your timeline's looking lonely", mood: 'casual' },
      { text: "Time to feed the algorithm", mood: 'chill' },
      { text: "The lads are waiting for content", mood: 'hype' }
    ]),
    
    ADD_STORY: () => this.getRandomVariant([
      { text: "Add to your story", mood: 'casual' },
      { text: "Drop something for the timeline", mood: 'hype' },
      { text: "Feed the people what they want", mood: 'epic' }
    ]),
    
    STORY_POSTED: () => this.getRandomVariant([
      { text: "Story's live! Watch those views roll in 📈", mood: 'hype' },
      { text: "Posted! The algorithm is fed", mood: 'chill' },
      { text: "That's content, baby! 🔥", mood: 'epic' }
    ])
  };

  // Loading & System
  static readonly SYSTEM = {
    LOADING: () => this.getRandomVariant([
      { text: "Getting the boys together...", mood: 'casual' },
      { text: "Loading up the goods...", mood: 'chill' },
      { text: "Hang tight, legend...", mood: 'hype' }
    ]),
    
    ERROR: () => this.getRandomVariant([
      { text: "Well, that didn't go to plan...", mood: 'casual' },
      { text: "Oops! Something went sideways", mood: 'chill' },
      { text: "Houston, we have a problem 🚨", mood: 'hype' }
    ]),
    
    SUCCESS: () => this.getRandomVariant([
      { text: "Nailed it! 🎯", mood: 'hype' },
      { text: "Smooth as butter ✨", mood: 'chill' },
      { text: "That's how we do it!", mood: 'epic' }
    ])
  };

  // Onboarding & Welcome
  static readonly ONBOARDING = {
    WELCOME: () => this.getRandomVariant([
      { text: "Welcome to the crew! 🎉", mood: 'hype' },
      { text: "You made it! Let's get you set up", mood: 'casual' },
      { text: "Time to build something legendary", mood: 'epic' }
    ]),
    
    FIRST_STEP: () => this.getRandomVariant([
      { text: "Let's start with the basics", mood: 'casual' },
      { text: "First things first...", mood: 'chill' },
      { text: "Time to make this place yours", mood: 'hype' }
    ])
  };

  // Quick access to commonly used phrases
  static readonly QUICK = {
    YES: "Let's go!",
    NO: "Nah, I'm good",
    MAYBE: "Maybe later",
    LOADING: "Hold up...",
    SUCCESS: "Nailed it!",
    ERROR: "Something went wrong",
    RETRY: "Try again",
    CANCEL: "Never mind",
    CONTINUE: "Keep going",
    DONE: "We're done here",
    EPIC: "That's epic! 🔥",
    LEGEND: "Absolute legend!",
    SICK: "That's sick! 🤘",
    FIRE: "Pure fire! 🔥"
  };
}

// Utility function for components to easily get lad copy
export const getLadCopy = (category: keyof typeof LadCopy, key: string, ...args: any[]): string => {
  try {
    const categoryObj = LadCopy[category] as any;
    if (categoryObj && typeof categoryObj[key] === 'function') {
      return categoryObj[key](...args);
    }
    return categoryObj?.[key] || 'Missing copy';
  } catch (error) {
    console.warn(`Missing lad copy: ${String(category)}.${key}`);
    return 'Missing copy';
  }
};

// Quick copy generator for dynamic content
export const generateLadCopy = (type: 'success' | 'error' | 'loading' | 'hype', context?: string): string => {
  switch (type) {
    case 'success':
      return LadCopy.SYSTEM.SUCCESS();
    case 'error':
      return LadCopy.SYSTEM.ERROR();
    case 'loading':
      return LadCopy.SYSTEM.LOADING();
    case 'hype':
      return LadCopy.QUICK.EPIC;
    default:
      return 'Something cool happened!';
  }
}; 