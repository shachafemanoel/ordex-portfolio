import os
import re

def get_route_from_path(path):
    # Remove 'app/' and 'page.tsx'
    parts = path.split(os.sep)
    if parts[0] == 'app':
        parts = parts[1:]
    if parts[-1] == 'page.tsx':
        parts = parts[:-1]
    
    # Filter out group directories like (admin), (platform), etc.
    route_parts = [p for p in parts if not (p.startswith('(') and p.endswith(')'))]
    
    return '/' + '/'.join(route_parts)

def analyze_page_content(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        is_legacy = False
        is_empty = False
        
        # Check for placeholder indicators
        if 'PLACEHOLDER' in content.upper() or 'TODO' in content.upper():
            is_legacy = True
            
        # Check if it's just a basic skeleton (e.g. less than 500 chars and no real components)
        if len(content) < 500 and 'export default' in content:
            # Further check if it's just a "Coming Soon" or similar
            if any(term in content.lower() for term in ['coming soon', 'under construction', 'work in progress']):
                is_legacy = True
                
        return {
            'is_legacy': is_legacy,
            'is_empty': len(content.strip()) < 50,
            'size': len(content)
        }
    except Exception as e:
        return {'error': str(e)}

def main():
    pages = []
    for root, dirs, files in os.walk('app'):
        for file in files:
            if file == 'page.tsx':
                full_path = os.path.join(root, file)
                route = get_route_from_path(full_path)
                analysis = analyze_page_content(full_path)
                pages.append({
                    'path': full_path,
                    'route': route,
                    'analysis': analysis
                })
    
    # Sort by route length
    pages.sort(key=lambda x: x['route'])
    
    print("| Route | File Path | Status | Size |")
    print("|-------|-----------|--------|------|")
    for p in pages:
        status = "LEGACY" if p['analysis'].get('is_legacy') else "ACTIVE"
        if p['analysis'].get('is_empty'):
            status = "EMPTY"
        print(f"| {p['route']} | {p['path']} | {status} | {p['analysis'].get('size')} |")

if __name__ == "__main__":
    main()
