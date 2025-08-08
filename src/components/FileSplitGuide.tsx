'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface FileSplitGuideProps {
  file: File;
  onClose: () => void;
}

export default function FileSplitGuide({ file, onClose }: FileSplitGuideProps) {
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitFiles, setSplitFiles] = useState<{ name: string; size: number; blob: Blob }[]>([]);

  const splitFile = async () => {
    setIsSplitting(true);
    
    try {
      const content = await file.text();
      const conversations = JSON.parse(content);
      
      if (!Array.isArray(conversations)) {
        throw new Error('Invalid file format');
      }

      const targetSize = 3.5 * 1024 * 1024; // 3.5MB target per file
      const files: { name: string; size: number; blob: Blob }[] = [];
      
      let currentChunk: any[] = [];
      let currentSize = 2; // Start with array brackets []
      let fileIndex = 1;
      
      for (const conversation of conversations) {
        const conversationJson = JSON.stringify(conversation);
        const conversationSize = conversationJson.length + (currentChunk.length > 0 ? 1 : 0); // +1 for comma
        
        // If adding this conversation would exceed target size, save current chunk
        if (currentSize + conversationSize > targetSize && currentChunk.length > 0) {
          const chunkJson = JSON.stringify(currentChunk, null, 2);
          const blob = new Blob([chunkJson], { type: 'application/json' });
          
          files.push({
            name: `${file.name.replace('.json', '')}_part_${fileIndex}.json`,
            size: blob.size,
            blob
          });
          
          fileIndex++;
          currentChunk = [];
          currentSize = 2;
        }
        
        currentChunk.push(conversation);
        currentSize += conversationSize;
      }
      
      // Save final chunk
      if (currentChunk.length > 0) {
        const chunkJson = JSON.stringify(currentChunk, null, 2);
        const blob = new Blob([chunkJson], { type: 'application/json' });
        
        files.push({
          name: `${file.name.replace('.json', '')}_part_${fileIndex}.json`,
          size: blob.size,
          blob
        });
      }
      
      setSplitFiles(files);
      
    } catch (error) {
      console.error('File splitting error:', error);
      alert('Failed to split file. Please ensure it\'s a valid ChatGPT export.');
    } finally {
      setIsSplitting(false);
    }
  };

  const downloadFile = (fileData: { name: string; blob: Blob }) => {
    const url = URL.createObjectURL(fileData.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileData.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    splitFiles.forEach(fileData => downloadFile(fileData));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>📂 File Too Large - Split Required</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>Your file ({Math.round(file.size / 1024 / 1024)}MB) exceeds the 4MB platform limit.</p>
          <p className="mt-2">We can automatically split it into smaller files that you can import separately:</p>
        </div>

        {splitFiles.length === 0 ? (
          <div className="space-y-4">
            <Button 
              onClick={splitFile}
              disabled={isSplitting}
              className="w-full"
            >
              {isSplitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Splitting file...
                </div>
              ) : (
                '✂️ Split File Into Importable Parts'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">
              ✅ File split into {splitFiles.length} parts, each under 4MB
            </div>
            
            <div className="space-y-2">
              {splitFiles.map((fileData, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="text-sm">
                    <div className="font-medium">{fileData.name}</div>
                    <div className="text-gray-500">{Math.round(fileData.size / 1024)}KB</div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => downloadFile(fileData)}
                  >
                    Download
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Button onClick={downloadAll} className="flex-1">
                📥 Download All Parts
              </Button>
              <Button variant="outline" onClick={onClose}>
                Done
              </Button>
            </div>
            
            <div className="text-xs text-gray-500 p-2 bg-blue-50 rounded">
              💡 After downloading, import each part separately. They'll create separate data sources that you can search together.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}