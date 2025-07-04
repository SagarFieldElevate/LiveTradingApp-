# 🏦 Coinbase Advanced Trade API Setup

Since you have **Coinbase Advanced Trade API** credentials, here's exactly how to set them up:

## 🔑 Your Coinbase Credentials

You mentioned you have:
- ✅ **Access Key** (API Key)
- ✅ **Signing Key** (API Secret) 
- ✅ **Passphrase**
- ✅ **Service Account ID**

## 📝 Configuration Steps

### Step 1: Copy the environment template
```bash
copy env.example .env
```

### Step 2: Edit the .env file
```bash
notepad .env
```

### Step 3: Fill in your Coinbase credentials
Replace these lines in your `.env` file:

```env
# Coinbase Advanced Trade API Configuration
COINBASE_API_KEY=your_access_key_here
COINBASE_API_SECRET=your_signing_key_here
COINBASE_PASSPHRASE=your_passphrase_here
COINBASE_SERVICE_ACCOUNT_ID=your_service_account_id_here
```

**With your actual values:**
```env
# Coinbase Advanced Trade API Configuration
COINBASE_API_KEY=your_actual_access_key
COINBASE_API_SECRET=your_actual_signing_key
COINBASE_PASSPHRASE=your_actual_passphrase
COINBASE_SERVICE_ACCOUNT_ID=your_actual_service_account_id
```

## 🔒 Security Best Practices

1. **Sandbox Mode**: The app automatically uses Coinbase Sandbox for development
2. **Production Mode**: Only use production keys when you're ready to go live
3. **API Permissions**: Ensure your API key has these permissions:
   - `trade` - Create and view trades
   - `view` - View account information
   - `transfer` - Transfer funds between accounts

## ✅ Testing Your Setup

After configuring, you can test your Coinbase connection:

1. Start the app: `quick-start.bat`
2. Go to: http://localhost:3001
3. Check the "Market Status" component
4. Look for "Coinbase: Connected" status

## 🚨 Important Notes

- **Never share your API credentials**
- **The passphrase is case-sensitive**
- **Service Account ID is required for Advanced Trade API**
- **Keep your credentials secure in the .env file**

## 🆘 Troubleshooting

If you see "Coinbase: Disconnected":
1. Double-check all 4 credentials are correct
2. Verify API key permissions
3. Check if your API key is active
4. Ensure no extra spaces in the .env file

Your Coinbase Advanced Trade API setup is now ready! 🎉 