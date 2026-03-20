const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\YuGe\\Desktop\\新建文件夹';
const files = ['index.html', 'articles.html', 'projects.html', 'gallery.html', 'links.html', 'about.html', 'article.html', 'guestbook.html'];

files.forEach(file => {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${file}`);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Regex to match <img> tags
    // We need to avoid adding loading="lazy" if it's already there or if alt is "TixXin Avatar" or "TixXin"
    const imgRegex = /<img\s+([^>]+)>/gi;
    
    const newContent = content.replace(imgRegex, (match, attrs) => {
        // Check if it already has loading="lazy"
        if (/loading\s*=\s*['"]lazy['"]/i.test(attrs)) {
            return match;
        }
        
        // Check if alt is "TixXin Avatar" or "TixXin"
        const altMatch = attrs.match(/alt\s*=\s*['"]([^'"]*)['"]/i);
        if (altMatch) {
            const altText = altMatch[1];
            if (altText === 'TixXin Avatar' || altText === 'TixXin') {
                return match; // Skip
            }
        }
        
        // Add loading="lazy"
        return `<img loading="lazy" ${attrs}>`;
    });
    
    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated ${file}`);
    } else {
        console.log(`No changes needed for ${file}`);
    }
});
