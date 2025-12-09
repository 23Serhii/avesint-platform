import { ContentSection } from '../components/content-section'
import { AccountForm } from './account-form'

export function SettingsAccount() {
  return (
    <ContentSection
      title='Аккаунт'
      desc='Відомості про публіковий запис.'
    >
      <AccountForm />
    </ContentSection>
  )
}
