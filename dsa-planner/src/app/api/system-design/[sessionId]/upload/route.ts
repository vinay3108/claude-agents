import { createSupabaseServerClient } from '@/infrastructure/supabase/server'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getCurrentUser()
    const { sessionId } = await params

    const formData = await request.formData()
    const file = formData.get('diagram') as File | null

    if (!file) return apiError(new Error('No file provided'))
    if (!file.type.startsWith('image/')) return apiError(new Error('File must be an image'))
    if (file.size > 5 * 1024 * 1024) return apiError(new Error('File too large (max 5MB)'))

    const supabase = await createSupabaseServerClient()
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${user.id}/${sessionId}/diagram.${ext}`

    const { error } = await supabase.storage
      .from('system-design-diagrams')
      .upload(path, file, { upsert: true })

    if (error) throw error

    const { data: urlData } = supabase.storage
      .from('system-design-diagrams')
      .getPublicUrl(path)

    return apiOk({ url: urlData.publicUrl })
  } catch (err) {
    return apiError(err)
  }
}
