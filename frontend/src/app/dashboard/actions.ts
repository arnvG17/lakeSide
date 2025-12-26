'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}

export async function getUserData() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return { error: 'Not authenticated' }
    }

    return { user }
}

export async function getRecordings() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { recordings: [] }
    }

    // Fetch real recordings from database
    const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching recordings:', error)
        return { recordings: [] }
    }

    return { recordings: data || [] }
}

export async function createRoom(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const roomName = formData.get('roomName') as string

    // TODO: Create room in database
    // const { data, error } = await supabase
    //   .from('Room')
    //   .insert({ owner_id: user.id, name: roomName })
    //   .select()
    //   .single()

    // if (error) {
    //   return { error: error.message }
    // }

    revalidatePath('/dashboard')
    return { success: true, roomName }
}

export async function deleteRecording(recordingId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    // TODO: Delete recording from database
    // const { error } = await supabase
    //   .from('recordings')
    //   .delete()
    //   .eq('id', recordingId)
    //   .eq('user_id', user.id)

    // if (error) {
    //   return { error: error.message }
    // }

    revalidatePath('/dashboard')
    return { success: true }
}

export async function getLoginHistory() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { loginHistory: [] }
    }

    // Fetch login history from login_logs table
    const { data, error } = await supabase
        .from('login_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('login_timestamp', { ascending: false })
        .limit(10)

    if (error) {
        console.error('Error fetching login history:', error)
        return { loginHistory: [] }
    }

    return { loginHistory: data || [] }
}

export async function getPreviousMeetings() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { meetings: [] }
    }

    // Fetch rooms created by the user
    const { data, error } = await supabase
        .from('Room')
        .select('*')
        .eq('ownerId', user.id)


        
        .order('createdAt', { ascending: false })

    if (error) {
        console.error('Error fetching meetings:', error)
        return { meetings: [] }
    }

    return { meetings: data || [] }
}
