import { createInterface } from 'node:readline/promises';
import { stdin,stdout } from 'node:process';
import { writeFile } from 'node:fs/promises';
import { randomBytes,pbkdf2Sync } from 'node:crypto';
import webpush from 'web-push';
// Creates a local, git-ignored secrets file. Never put this file in public/ or commit it.
const rl=createInterface({input:stdin,output:stdout});
const password=await rl.question('设置网站访问密码（至少 12 字符，输入会显示，仅在私人终端操作）：');rl.close();
if(password.length<12||password.length>256)throw Error('密码需为 12–256 字符');
const salt=randomBytes(16),digest=pbkdf2Sync(password,salt,100000,32,'sha256');
const vapid=webpush.generateVAPIDKeys();
const contents=`PASSWORD_HASH="${salt.toString('base64url')}.${digest.toString('base64url')}"\nTOKEN_KEY="${randomBytes(32).toString('base64url')}"\nVAPID_PUBLIC_KEY="${vapid.publicKey}"\nVAPID_PRIVATE_KEY="${vapid.privateKey}"\nAPP_ORIGIN="http://localhost:8787"\n`;
await writeFile('.dev.vars',contents,{mode:0o600,flag:'wx'});
console.log('已写入 .dev.vars（未上传）。请不要分享或提交该文件。');
