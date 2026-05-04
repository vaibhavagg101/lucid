import DynamicWorkspace from './dynamic'

export const metadata = {
    title: 'Workspace | LUCID',
    description: 'Your personal workspace.',
}

export default function Workspace() {
    return <div className='main'>
        <DynamicWorkspace />
    </div>
}