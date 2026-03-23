'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?error=Could not authenticate user')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function demoLogin(formData: FormData) {
  // Demo action for rapid prototyping without setting up real Supabase users yet
  // In a real app, this would sign in as a pre-created test user
  const role = formData.get('role') as string;
  const email = `demo_${role}@creditflow.local`
  
  const supabase = await createClient()
  
  // Try to set up logic to login using test users if they exist
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: 'password123',
  })
  
  if (error) {
    redirect('/login?error=Demo user not created yet in Supabase Auth')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
