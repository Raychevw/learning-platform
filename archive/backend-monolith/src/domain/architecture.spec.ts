import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function getFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else if (filePath.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

describe('Architecture Dependency Rules', () => {
  it('Domain layer should not depend on other layers', () => {
    const domainDir = path.join(__dirname);
    const domainFiles = getFiles(domainDir);
    
    for (const file of domainFiles) {
      if (file.endsWith('architecture.spec.ts')) continue;
      
      const content = fs.readFileSync(file, 'utf8');
      
      // Domain should not import from application, infrastructure, or presentation
      const forbiddenImports = [
        /import.*from.*application/,
        /import.*from.*infrastructure/,
        /import.*from.*presentation/,
        /import.*@nestjs/, // Domain should also not depend on framework
        /import.*typeorm/
      ];
      
      for (const regex of forbiddenImports) {
        expect(content).not.toMatch(regex);
      }
    }
  });
});
