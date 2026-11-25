import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseCsv } from '@/core/tabular/csv';
import { createTestRepository, renderApp, type TestRepositories } from '../../../../tests/setup/render';
import { draftsFrom, draftsToCsv } from './SentenceEditor';

async function setup(): Promise<{ repos: TestRepositories; projectId: string }> {
  const repos = createTestRepository();
  const project = await repos.repository.create({ name: 'Phân loại câu', projectType: 'text' });
  return { repos, projectId: project.id };
}

function render(repos: TestRepositories, projectId: string) {
  return renderApp(`/studio/${projectId}`, repos.repository, repos.dataset, repos.experiments, repos.tables);
}

describe('Studio văn bản tiếng Việt', () => {
  test('bộ câu chủ đề: tách âm tiết, TF-IDF, huấn luyện Naive Bayes, giải thích từng từ', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    await userEvent.click(await screen.findByRole('button', { name: /Chủ đề: thời tiết/ }));
    expect(await screen.findByTestId('text-size')).toHaveTextContent('72 câu · 3 nhóm');
    expect(screen.getByText('Chưa thấy vấn đề nào.')).toBeInTheDocument();

    const sentence = screen.getByLabelText('Câu để xem (sửa thoải mái)');
    fireEvent.change(sentence, { target: { value: 'Trời mưa, trời lạnh! Xyzabc' } });
    expect(within(screen.getByTestId('text-tokens')).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['trời', 'mưa', 'trời', 'lạnh', 'xyzabc']);
    expect(screen.getByText(/bị bỏ qua: xyzabc/)).toBeInTheDocument();
    const trời = within(screen.getByTestId('tfidf-table')).getByRole('rowheader', { name: 'trời' }).closest('tr')!;
    expect(within(trời).getAllByRole('cell')[0]).toHaveTextContent('2');

    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    expect(await screen.findByTestId('tabular-confusion')).toBeInTheDocument();
    expect(within(screen.getByTestId('text-top-terms')).getByText(/thời tiết:/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Gõ một câu'), { target: { value: 'Hôm nay trời nắng, gió mát.' } });
    expect(screen.getByTestId('text-prediction')).toHaveTextContent('Máy đoán: thời tiết');
    const marks = screen.getByTestId('text-highlight').querySelectorAll('mark');
    expect([...marks].map((m) => m.textContent)).toContain('trời');
    expect(screen.getByTestId('text-highlight')).toHaveTextContent('Hôm nay trời nắng, gió mát.');
    expect(screen.getByRole('button', { name: 'Tải notebook (.ipynb)' })).toBeInTheDocument();
  });

  test('tự gõ câu cho từng nhóm, trợ lý báo câu mâu thuẫn; đổi mô hình thì phải huấn luyện lại', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    await userEvent.click(await screen.findByRole('button', { name: 'Mở trình soạn câu' }));
    const name1 = screen.getByLabelText('Tên nhóm 1');
    await userEvent.clear(name1);
    await userEvent.type(name1, 'vui');
    const name2 = screen.getByLabelText('Tên nhóm 2');
    await userEvent.clear(name2);
    await userEvent.type(name2, 'buồn');
    fireEvent.change(screen.getByLabelText('Các câu của nhóm vui'), {
      target: { value: 'Hôm nay em rất vui\nĐược điểm mười thật vui\nCả lớp cười vui vẻ\nĐi chơi công viên vui quá\nGặp lại bạn cũ, vui lắm\nCâu giống nhau' },
    });
    fireEvent.change(screen.getByLabelText('Các câu của nhóm buồn'), {
      target: { value: 'Em buồn vì bị điểm kém\nTrời mưa nên buồn\nBạn thân chuyển trường, em buồn\nMất chiếc bút yêu thích, buồn quá\nKhông được đi chơi, thật buồn\nCâu giống nhau' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Lưu các câu' }));
    expect(await screen.findByTestId('text-size')).toHaveTextContent('12 câu · 2 nhóm');
    expect(screen.getByTestId('text-issues')).toHaveTextContent('"Câu giống nhau" có mặt ở nhiều nhóm (vui / buồn)');

    await userEvent.click(screen.getByRole('radio', { name: /Hồi quy logistic/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    expect(await screen.findByTestId('text-total')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Âm tiết \+ cặp/ }));
    expect(screen.getByText(/bấm Huấn luyện để cập nhật/)).toBeInTheDocument();
    expect(screen.queryByTestId('text-total')).not.toBeInTheDocument();
  });

  test('Xưởng mô hình tạo được dự án Văn bản', async () => {
    const repos = createTestRepository();
    renderApp('/studio', repos.repository, repos.dataset, repos.experiments, repos.tables);
    await userEvent.type(await screen.findByLabelText('Tên dự án'), 'Góp ý căng tin');
    await userEvent.click(screen.getByRole('radio', { name: /Văn bản/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án' }));
    expect(await screen.findByRole('button', { name: /Góp ý căng tin: khen/ })).toBeInTheDocument();
  });
});

describe('trình soạn câu', () => {
  test('gom câu theo nhóm rồi ghép lại thành CSV hai cột, bỏ dòng trống', () => {
    const drafts = draftsFrom([
      { label: 'khen', text: 'Ngon, rẻ' },
      { label: 'chê', text: 'Chậm' },
      { label: 'khen', text: 'Sạch sẽ' },
      { label: '', text: 'không nhãn' },
    ]);
    expect(drafts).toEqual([{ name: 'khen', lines: 'Ngon, rẻ\nSạch sẽ' }, { name: 'chê', lines: 'Chậm' }]);
    const csv = draftsToCsv([...drafts, { name: 'trống', lines: '\n  \n' }]);
    expect(parseCsv(csv)).toMatchObject({ ok: true, table: { headers: ['nhãn', 'văn bản'], rows: [['khen', 'Ngon, rẻ'], ['khen', 'Sạch sẽ'], ['chê', 'Chậm']] } });
  });
});
