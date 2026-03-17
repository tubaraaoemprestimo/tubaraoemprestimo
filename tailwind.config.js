/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./App.tsx",
        "./index.tsx"
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                gold: 'var(--color-secondary)',
                shark: 'var(--color-primary)',
                background: 'var(--color-background)',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'pulse-slow': 'pulse 3s infinite',
            },
            typography: {
                DEFAULT: {
                    css: {
                        maxWidth: 'none',
                        color: '#a1a1aa',
                        a: {
                            color: '#D4AF37',
                            '&:hover': {
                                color: '#B8860B',
                            },
                        },
                        strong: {
                            color: '#ffffff',
                        },
                        h1: {
                            color: '#ffffff',
                        },
                        h2: {
                            color: '#ffffff',
                        },
                        h3: {
                            color: '#ffffff',
                        },
                        h4: {
                            color: '#ffffff',
                        },
                        code: {
                            color: '#D4AF37',
                        },
                        'ul > li::marker': {
                            color: '#D4AF37',
                        },
                        'ol > li::marker': {
                            color: '#D4AF37',
                        },
                    },
                },
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
