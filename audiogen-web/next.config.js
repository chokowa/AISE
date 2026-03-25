/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopackのルート判定を手動で安定させます
  experimental: {
    // もしTurbopackが動く場合はルートをここに固定
    turbo: {
      root: '.'
    }
  }
};

module.exports = nextConfig;
