import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoriesProvider, type Repositories } from '@/storage/repository-context';
import { createTestRepository, type TestRepositories } from '../../../tests/setup/render';
import { NotebookProvider } from './NotebookContext';
import { StepNotebook } from './StepNotebook';

function asRepositories(r: TestRepositories): Repositories {
  return { ...r, projects: r.repository };
}

async function setup(existing?: string) {
  const r = createTestRepository();
  const project = await r.repository.create({ name: 'Mèo chó', projectType: 'image' });
  if (existing) await r.notebook.save(project.id, 'represent', existing);
  render(
    <RepositoriesProvider repositories={asRepositories(r)}>
      <NotebookProvider projectId={project.id} projectType="image">
        <StepNotebook step="represent" />
      </NotebookProvider>
    </RepositoriesProvider>,
  );
  return { r, project };
}

describe('Sổ tay ở từng bước', () => {
  test('thu gọn sẵn; mở ra thấy câu hỏi quan sát, câu hỏi giải thích và ô ghi chép', async () => {
    await setup();
    const toggle = await screen.findByRole('button', { name: /Sổ tay.*2 câu hỏi/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Ghi chép của em')).toBeNull();

    await userEvent.setup().click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/lớp nào tách riêng, lớp nào nằm lẫn vào nhau/)).toBeInTheDocument();
    expect(screen.getByText(/Vì sao hai ảnh trông giống nhau/)).toBeInTheDocument();
    expect(screen.getByLabelText('Ghi chép của em')).toHaveValue('');
  });

  test('ghi xong rời ô thì lưu ngay vào dự án', async () => {
    const { r, project } = await setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Sổ tay/ }));
    await user.type(screen.getByLabelText('Ghi chép của em'), 'Mèo và chó lẫn vào nhau');
    await user.tab();

    expect(await screen.findByText('Đã lưu')).toBeInTheDocument();
    expect(await r.notebook.list(project.id)).toEqual([{ step: 'represent', text: 'Mèo và chó lẫn vào nhau' }]);
  });

  test('đang gõ dở cũng tự lưu sau một lúc', async () => {
    const { r, project } = await setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Sổ tay/ }));
    await user.type(screen.getByLabelText('Ghi chép của em'), 'Có 3 lớp');

    await waitFor(async () => expect(await r.notebook.list(project.id)).toHaveLength(1), { timeout: 3000 });
  });

  test('mở lại dự án: thấy "đã ghi" và nội dung cũ', async () => {
    await setup('Mèo nằm bên trái');
    const toggle = await screen.findByRole('button', { name: /Sổ tay.*đã ghi/ });
    await userEvent.setup().click(toggle);
    expect(screen.getByLabelText('Ghi chép của em')).toHaveValue('Mèo nằm bên trái');
  });

  test('không nằm trong dự án nào thì không hiện', () => {
    const { container } = render(<StepNotebook step="represent" />);
    expect(container).toBeEmptyDOMElement();
  });
});
