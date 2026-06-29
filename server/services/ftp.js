const { Client } = require('basic-ftp');
const path = require('path');
const fs = require('fs');

async function uploadToFtp(localPath, remoteFilename) {
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASSWORD;
  const basePath = process.env.FTP_BASE_PATH || '/banner-dat';

  if (!host || !user || !password) return null;

  const client = new Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host,
      user,
      password,
      secure: false,
    });
    await client.ensureDir(basePath);
    await client.uploadFrom(localPath, path.join(basePath, remoteFilename));
    const baseUrl = process.env.FTP_BASE_URL || `ftp://${host}`;
    return `${baseUrl.replace(/\/$/, '')}/${remoteFilename}`;
  } catch (err) {
    console.error('FTP upload error:', err.message);
    return null;
  } finally {
    client.close();
  }
}

module.exports = { uploadToFtp };
