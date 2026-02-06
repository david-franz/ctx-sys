// @ts-check
/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'ctx-sys',
  tagline: 'Intelligent context management for AI-assisted coding',
  favicon: 'img/favicon.ico',

  url: 'https://ctx-sys.dev',
  baseUrl: '/',

  organizationName: 'ctx-sys',
  projectName: 'ctx-sys',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.json'),
          editUrl: 'https://github.com/your-org/ctx-sys/tree/main/website/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'ctx-sys',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docs',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://github.com/your-org/ctx-sys',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Getting Started',
                to: '/docs/getting-started/introduction',
              },
              {
                label: 'Guides',
                to: '/docs/guides/claude-integration',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub Discussions',
                href: 'https://github.com/your-org/ctx-sys/discussions',
              },
              {
                label: 'Discord',
                href: '#',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/your-org/ctx-sys',
              },
              {
                label: 'npm',
                href: 'https://www.npmjs.com/package/ctx-sys',
              },
            ],
          },
        ],
        copyright: `Copyright ${new Date().getFullYear()} ctx-sys. Built with Docusaurus.`,
      },
    }),
};

module.exports = config;
