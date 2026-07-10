import re

def transform_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Add Tabs import
    if 'import { Tabs' not in content:
        content = content.replace('import { Button } from "@/components/ui/button";', 'import { Button } from "@/components/ui/button";\nimport { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";')
    
    # 2. Remove stepper progress bar
    stepper_regex = r'{/\* Stepper Progress \*/}.*?</div>\s*</div>\s*</div>'
    content = re.sub(stepper_regex, '', content, flags=re.DOTALL)
    
    stepper2 = r'<div className="grid grid-cols-3 gap-2 border-y py-4 my-2 bg-slate-50/50 dark:bg-zinc-900/30 rounded-lg text-center">.*?</div>\s*</div>\s*</div>'
    content = re.sub(stepper2, '', content, flags=re.DOTALL)

    # 3. Replace AnimatePresence and motion with Tabs wrapper
    content = re.sub(r'<AnimatePresence mode="wait">', '<Tabs defaultValue="identitas" className="w-full space-y-6">\n          <TabsList className="grid w-full grid-cols-3">\n            <TabsTrigger value="identitas">Identitas Siswa</TabsTrigger>\n            <TabsTrigger value="akademik">Status & Akademik</TabsTrigger>\n            <TabsTrigger value="keluarga">Orang Tua & Wali</TabsTrigger>\n          </TabsList>', content)
    content = re.sub(r'</AnimatePresence>', '</Tabs>', content)
    
    # 4. Replace Step 1 wrapper
    content = re.sub(r'{currentStep === 1 && \(\s*<motion\.div.*?>', '<TabsContent value="identitas">', content, flags=re.DOTALL)
    
    # 5. Replace Step 2 wrapper
    content = re.sub(r'{currentStep === 2 && \(\s*<motion\.div.*?>', '<TabsContent value="akademik">', content, flags=re.DOTALL)
    
    # 6. Replace Step 3 wrapper
    content = re.sub(r'{currentStep === 3 && \(\s*<motion\.div.*?>', '<TabsContent value="keluarga">', content, flags=re.DOTALL)
    
    # 7. Replace closing tags for motion.div )} with TabsContent closing tag
    content = re.sub(r'</motion\.div>\s*\)', '</TabsContent>', content)
    
    # 8. Navigation buttons replacement
    # In both files we'll just replace everything from {/* Navigation Buttons */} to </form>
    # Note: `alumni-tambah` might have different cancel path, so let's match the specific file
    is_edit = 'alumni-detail/edit' in filepath
    cancel_href = '/admin/siswa/alumni-detail?id=${alumniId}' if is_edit else '/admin/siswa'
    
    new_nav = f'''{{/* Submit Button */}}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Link href="{cancel_href}">
              <Button type="button" variant="ghost" className="h-9">
                Batal
              </Button>
            </Link>
            <Button type="submit" disabled={{loading}} className="h-9 flex items-center gap-1">
              {{loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Simpan Data
                </>
              )}}
            </Button>
          </div>
        </form>'''
    
    content = re.sub(r'{/\* Navigation Buttons \*/}.*?</form>', new_nav, content, flags=re.DOTALL)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
transform_file('d:/antigravity/sekolahku/app/(dashboard)/admin/siswa/alumni-detail/edit/page.tsx')
transform_file('d:/antigravity/sekolahku/app/(dashboard)/admin/siswa/alumni-tambah/page.tsx')
