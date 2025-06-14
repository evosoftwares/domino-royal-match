
import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../utils/auth-helpers';
import { GameHelpers } from '../utils/game-helpers';
import { DatabaseHelpers } from '../utils/database-helpers';

test.describe('Connectivity Tests', () => {
  let authHelpers: AuthHelpers;
  let gameHelpers: GameHelpers;
  let databaseHelpers: DatabaseHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    gameHelpers = new GameHelpers(page);
    databaseHelpers = new DatabaseHelpers();
    
    await databaseHelpers.cleanup();
    await page.goto('/');
  });

  test.afterEach(async () => {
    await databaseHelpers.cleanup();
  });

  test.describe('Reconnection Handling', () => {
    test('should reconnect after network interruption', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      const gameId = await gameHelpers.createTestGame(users.map(u => u.id));
      await page.goto(`/game2/${gameId}`);
      
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Verificar conexão inicial
      await expect(page.locator('[data-testid="health-indicator"]')).toContainText(/connected|conectado/i);
      
      // Simular perda de conexão
      await page.context().setOffline(true);
      
      // Aguardar detecção de desconexão
      await page.waitForTimeout(3000);
      
      // Verificar indicador de desconexão
      await expect(page.locator('[data-testid="health-indicator"]')).toContainText(/disconnected|desconectado/i);
      
      // Restaurar conexão
      await page.context().setOffline(false);
      
      // Aguardar reconexão
      await page.waitForTimeout(5000);
      
      // Verificar reconexão
      await expect(page.locator('[data-testid="health-indicator"]')).toContainText(/connected|conectado/i);
      
      // Verificar que o jogo ainda funciona
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      await expect(page.locator('[data-testid="player-hand"]')).toBeVisible();
    });

    test('should queue moves during disconnection', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      // Criar jogo onde é o turno do jogador
      const gameId = await databaseHelpers.createGameWithState({
        player_ids: users.map(u => u.id),
        current_player: users[0].id,
        player_hands: {
          [users[0].id]: [{ l: 1, r: 2 }]
        }
      });
      
      await page.goto(`/game2/${gameId}`);
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Simular desconexão
      await page.context().setOffline(true);
      
      // Tentar fazer uma jogada offline
      const playablePiece = page.locator('[data-testid="hand-piece"]:not([data-disabled="true"])').first();
      if (await playablePiece.count() > 0) {
        await playablePiece.click();
        
        // Verificar que a jogada foi armazenada localmente
        await expect(page.locator('[data-testid="pending-moves"]')).toContainText(/1/);
      }
      
      // Restaurar conexão
      await page.context().setOffline(false);
      
      // Aguardar sincronização
      await page.waitForTimeout(5000);
      
      // Verificar que as jogadas pendentes foram sincronizadas
      await expect(page.locator('[data-testid="pending-moves"]')).toContainText(/0/);
      
      // Verificar feedback de sincronização
      await expect(page.locator('.sonner-toast')).toContainText(/sincroniz/i);
    });

    test('should handle reconnection to updated game state', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      const gameId = await gameHelpers.createTestGame(users.map(u => u.id));
      await page.goto(`/game2/${gameId}`);
      
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Obter estado inicial
      const initialPiecesCount = await page.locator('[data-testid="placed-pieces"] [data-testid="board-piece"]').count();
      
      // Simular desconexão
      await page.context().setOffline(true);
      
      // Simular mudanças no jogo via database (outros jogadores jogaram)
      await databaseHelpers.simulateGameMove(gameId, users[1].id, { l: 2, r: 3 });
      
      // Restaurar conexão
      await page.context().setOffline(false);
      
      // Aguardar sincronização
      await page.waitForTimeout(5000);
      
      // Verificar que o estado foi atualizado
      const updatedPiecesCount = await page.locator('[data-testid="placed-pieces"] [data-testid="board-piece"]').count();
      expect(updatedPiecesCount).toBeGreaterThan(initialPiecesCount);
    });
  });

  test.describe('State Synchronization', () => {
    test('should sync state between multiple clients', async ({ browser }) => {
      const users = await authHelpers.createMultipleUsers(4);
      
      // Criar dois contextos para simular dois clientes
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      // Login com usuários diferentes
      await page1.goto('/');
      await page2.goto('/');
      await new AuthHelpers(page1).loginWithCredentials(users[0].email, users[0].password);
      await new AuthHelpers(page2).loginWithCredentials(users[1].email, users[1].password);
      
      // Criar jogo
      const gameId = await databaseHelpers.createGameWithState({
        player_ids: users.map(u => u.id),
        current_player: users[0].id,
        player_hands: {
          [users[0].id]: [{ l: 1, r: 2 }],
          [users[1].id]: [{ l: 3, r: 4 }]
        }
      });
      
      // Ambos navegam para o jogo
      await page1.goto(`/game2/${gameId}`);
      await page2.goto(`/game2/${gameId}`);
      
      await expect(page1.locator('[data-testid="game-board"]')).toBeVisible();
      await expect(page2.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Player 1 faz uma jogada
      const playablePiece = page1.locator('[data-testid="hand-piece"]:not([data-disabled="true"])').first();
      if (await playablePiece.count() > 0) {
        await playablePiece.click();
        
        // Aguardar sincronização
        await page1.waitForTimeout(2000);
        
        // Verificar que Player 2 vê a atualização
        await expect(page2.locator('[data-testid="my-turn-indicator"]')).toBeVisible();
        
        // Verificar que o tabuleiro foi atualizado em ambos os clientes
        const pieces1 = await page1.locator('[data-testid="board-piece"]').count();
        const pieces2 = await page2.locator('[data-testid="board-piece"]').count();
        expect(pieces1).toBe(pieces2);
      }
      
      // Cleanup
      await context1.close();
      await context2.close();
    });

    test('should handle rapid state changes', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      const gameId = await databaseHelpers.createGameWithState({
        player_ids: users.map(u => u.id),
        current_player: users[0].id,
        player_hands: {
          [users[0].id]: [{ l: 1, r: 2 }, { l: 2, r: 3 }, { l: 3, r: 4 }]
        }
      });
      
      await page.goto(`/game2/${gameId}`);
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Fazer múltiplas jogadas rápidas
      const playablePieces = page.locator('[data-testid="hand-piece"]:not([data-disabled="true"])');
      const initialCount = await playablePieces.count();
      
      for (let i = 0; i < Math.min(3, initialCount); i++) {
        if (await page.locator('[data-testid="my-turn-indicator"]').isVisible()) {
          const piece = page.locator('[data-testid="hand-piece"]:not([data-disabled="true"])').first();
          if (await piece.count() > 0) {
            await piece.click();
            await page.waitForTimeout(500); // Pequena pausa entre jogadas
          }
        }
      }
      
      // Aguardar estabilização
      await page.waitForTimeout(3000);
      
      // Verificar que todas as jogadas foram sincronizadas
      await expect(page.locator('[data-testid="sync-status"]')).toContainText(/synced|sincronizado/i);
    });

    test('should maintain consistency during concurrent updates', async ({ browser }) => {
      const users = await authHelpers.createMultipleUsers(4);
      
      // Criar múltiplos contextos
      const contexts = await Promise.all(Array(4).fill(0).map(() => browser.newContext()));
      const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
      
      // Login todos os usuários
      for (let i = 0; i < 4; i++) {
        await pages[i].goto('/');
        await new AuthHelpers(pages[i]).loginWithCredentials(users[i].email, users[i].password);
      }
      
      // Criar jogo com múltiplas peças jogáveis para cada jogador
      const gameId = await databaseHelpers.createGameWithState({
        player_ids: users.map(u => u.id),
        current_player: users[0].id,
        player_hands: {
          [users[0].id]: [{ l: 1, r: 2 }],
          [users[1].id]: [{ l: 2, r: 3 }],
          [users[2].id]: [{ l: 3, r: 4 }],
          [users[3].id]: [{ l: 4, r: 5 }]
        }
      });
      
      // Todos navegam para o jogo
      for (const page of pages) {
        await page.goto(`/game2/${gameId}`);
        await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      }
      
      // Simular turnos sequenciais rápidos
      for (let turn = 0; turn < 4; turn++) {
        const currentPage = pages[turn];
        
        // Aguardar ser o turno do jogador
        await expect(currentPage.locator('[data-testid="my-turn-indicator"]')).toBeVisible({ timeout: 10000 });
        
        // Fazer jogada
        const playablePiece = currentPage.locator('[data-testid="hand-piece"]:not([data-disabled="true"])').first();
        if (await playablePiece.count() > 0) {
          await playablePiece.click();
        } else {
          await currentPage.locator('[data-testid="pass-turn-button"]').click();
        }
        
        // Aguardar processamento
        await currentPage.waitForTimeout(1000);
      }
      
      // Verificar consistência em todos os clientes
      const finalBoardStates = await Promise.all(
        pages.map(page => page.locator('[data-testid="board-piece"]').count())
      );
      
      // Todos devem ter o mesmo número de peças no tabuleiro
      expect(new Set(finalBoardStates).size).toBe(1);
      
      // Cleanup
      await Promise.all(contexts.map(ctx => ctx.close()));
    });
  });

  test.describe('Conflict Detection', () => {
    test('should detect and resolve state conflicts', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      const gameId = await gameHelpers.createTestGame(users.map(u => u.id));
      await page.goto(`/game2/${gameId}`);
      
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Simular conflito forçando estados divergentes
      await page.context().setOffline(true);
      
      // Fazer mudança local
      if (await page.locator('[data-testid="my-turn-indicator"]').isVisible()) {
        const playablePiece = page.locator('[data-testid="hand-piece"]:not([data-disabled="true"])').first();
        if (await playablePiece.count() > 0) {
          await playablePiece.click();
        }
      }
      
      // Simular mudança conflitante no servidor
      await databaseHelpers.simulateConflictingGameState(gameId);
      
      // Restaurar conexão
      await page.context().setOffline(false);
      
      // Aguardar detecção de conflito
      await page.waitForTimeout(5000);
      
      // Verificar que o conflito foi detectado
      await expect(page.locator('[data-testid="conflict-dialog"]')).toBeVisible();
      
      // Resolver conflito
      await page.locator('[data-testid="resolve-conflict-server"]').click();
      
      // Verificar que o conflito foi resolvido
      await expect(page.locator('[data-testid="conflict-dialog"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="sync-status"]')).toContainText(/synced/i);
    });

    test('should handle multiple simultaneous moves', async ({ browser }) => {
      const users = await authHelpers.createMultipleUsers(4);
      
      // Criar dois contextos para simular moves simultâneos
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      await page1.goto('/');
      await page2.goto('/');
      
      await new AuthHelpers(page1).loginWithCredentials(users[0].email, users[0].password);
      await new AuthHelpers(page2).loginWithCredentials(users[0].email, users[0].password); // Mesmo usuário
      
      const gameId = await databaseHelpers.createGameWithState({
        player_ids: users.map(u => u.id),
        current_player: users[0].id,
        player_hands: {
          [users[0].id]: [{ l: 1, r: 2 }, { l: 2, r: 3 }]
        }
      });
      
      await page1.goto(`/game2/${gameId}`);
      await page2.goto(`/game2/${gameId}`);
      
      await expect(page1.locator('[data-testid="game-board"]')).toBeVisible();
      await expect(page2.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Tentar jogar simultaneamente em ambos os clientes
      const [piece1, piece2] = await Promise.all([
        page1.locator('[data-testid="hand-piece"]:not([data-disabled="true"])').first(),
        page2.locator('[data-testid="hand-piece"]:not([data-disabled="true"])').first()
      ]);
      
      // Clicks simultâneos
      await Promise.all([
        piece1.click(),
        piece2.click()
      ]);
      
      // Aguardar resolução
      await page1.waitForTimeout(3000);
      await page2.waitForTimeout(3000);
      
      // Verificar que apenas uma jogada foi aceita
      const [toasts1, toasts2] = await Promise.all([
        page1.locator('.sonner-toast').count(),
        page2.locator('.sonner-toast').count()
      ]);
      
      // Pelo menos um deve ter recebido feedback
      expect(toasts1 + toasts2).toBeGreaterThan(0);
      
      // Verificar consistência final
      const [pieces1, pieces2] = await Promise.all([
        page1.locator('[data-testid="board-piece"]').count(),
        page2.locator('[data-testid="board-piece"]').count()
      ]);
      
      expect(pieces1).toBe(pieces2);
      
      // Cleanup
      await context1.close();
      await context2.close();
    });

    test('should recover from invalid state', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      // Criar estado inicial válido
      const gameId = await gameHelpers.createTestGame(users.map(u => u.id));
      await page.goto(`/game2/${gameId}`);
      
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Injetar estado inválido via database
      await databaseHelpers.injectInvalidGameState(gameId);
      
      // Forçar refresh/reconexão
      await page.reload();
      
      // Aguardar detecção e correção
      await page.waitForTimeout(5000);
      
      // Verificar que o sistema detectou e corrigiu o problema
      await expect(page.locator('[data-testid="recovery-indicator"]')).toBeVisible();
      
      // Verificar que o jogo voltou a funcionar
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      await expect(page.locator('[data-testid="player-hand"]')).toBeVisible();
    });
  });

  test.describe('Network Quality Handling', () => {
    test('should adapt to slow network conditions', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      const gameId = await gameHelpers.createTestGame(users.map(u => u.id));
      
      // Simular conexão lenta
      await page.context().setNetworkConditions({
        offline: false,
        downloadThroughput: 50 * 1024, // 50 KB/s
        uploadThroughput: 50 * 1024,
        latency: 1000 // 1 segundo de latência
      });
      
      await page.goto(`/game2/${gameId}`);
      
      // Verificar que o jogo ainda carrega (mesmo que lentamente)
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible({ timeout: 15000 });
      
      // Verificar indicador de rede lenta
      await expect(page.locator('[data-testid="slow-network-indicator"]')).toBeVisible();
      
      // Tentar fazer uma jogada
      if (await page.locator('[data-testid="my-turn-indicator"]').isVisible()) {
        const playablePiece = page.locator('[data-testid="hand-piece"]:not([data-disabled="true"])').first();
        if (await playablePiece.count() > 0) {
          await playablePiece.click();
          
          // Verificar que há feedback de "processando"
          await expect(page.locator('[data-testid="move-processing"]')).toBeVisible();
          
          // Aguardar conclusão (com timeout maior)
          await expect(page.locator('.sonner-toast')).toContainText(/sucesso|processado/i, { timeout: 10000 });
        }
      }
      
      // Restaurar velocidade normal
      await page.context().setNetworkConditions(null);
    });

    test('should show appropriate loading states', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      // Simular latência alta
      await page.context().setNetworkConditions({
        offline: false,
        latency: 2000 // 2 segundos
      });
      
      const gameId = await gameHelpers.createTestGame(users.map(u => u.id));
      await page.goto(`/game2/${gameId}`);
      
      // Verificar loading state inicial
      await expect(page.locator('[data-testid="game-loading"]')).toBeVisible();
      
      // Aguardar carregamento completo
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible({ timeout: 15000 });
      
      // Verificar que loading desapareceu
      await expect(page.locator('[data-testid="game-loading"]')).not.toBeVisible();
      
      // Restaurar condições normais
      await page.context().setNetworkConditions(null);
    });
  });
});
