import { readFileSync } from 'fs';
import { validateChatGPTExport, parseChatGPTExport } from '../src/lib/chatgpt-import';

const path = process.argv[2] || 'sample-conversations.json';
const content = readFileSync(path, 'utf8');
const validation = validateChatGPTExport(content);
console.log('validation:', validation);
if (validation.valid) {
  const convs = parseChatGPTExport(content);
  console.log('parsed_count:', convs.length);
  console.log('first_title:', convs[0]?.title);
  console.log('first_messages:', convs[0]?.messages?.slice(0,2));
}
