import { pathScreen } from './screens/path.js';
import { lessonScreen, resultScreen } from './screens/lesson.js';
import { reviewScreen, dictionaryScreen, profileScreen, settingsScreen, onboardingScreen } from './screens/misc.js';
import { chatListScreen, chatScreen } from './screens/chat.js';
import { roomScreen } from './screens/room.js';

export const screens = {
  path: pathScreen,
  lesson: lessonScreen,
  result: resultScreen,
  review: reviewScreen,
  dictionary: dictionaryScreen,
  profile: profileScreen,
  settings: settingsScreen,
  onboarding: onboardingScreen,
  chats: chatListScreen,
  chat: chatScreen,
  room: roomScreen,
};
