import webpush from 'web-push'

// a key pair for push notifications: put both in the server's environment, once
const keys = webpush.generateVAPIDKeys()
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
