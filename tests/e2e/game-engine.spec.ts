
import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../utils/auth-helpers';
import { GameHelpers } from '../utils/game-helpers';
import { DatabaseHelpers } from '../utils/database-helpers';

test.describe('Game Engine Tests', () => {
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

  test.describe('Game Initialization', () => {
    test('should initialize game with correct board state', async ({ page }) => {
      // Criar 4 usuários para um jogo completo
      const users = await authHelpers.createMultipleUsers(4);
      
      // Login com o primeiro usuário
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      // Entrar na fila de matchmaking
      await gameHelpers.joinMatchmakingQueue();
      
      // Simular outros usuários entrando na fila (via database)
      for (let i = 1; i < 4; i++) {
        await databaseHelpers.addUserToQueue(users[i].id);
      }
      
      // Trigger game creation
      await databaseHelpers.createGameFromQueue();
      
      // Verificar redirecionamento para o jogo
      await expect(page).toHaveURL(/\/game2\/[a-f0-9-]+/);
      
      // Verificar elementos da interface do jogo
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      await expect(page.locator('[data-testid="player-hand"]')).toBeVisible();
      await expect(page.locator('[data-testid="opponents-list"]')).toBeVisible();
      
      // Verificar que há peças no tabuleiro (primeira peça automática)
      await expect(page.locator('[data-testid="placed-pieces"]')).toBeVisible();
      
      // Verificar que o jogador tem peças na mão
      const handPieces = page.locator('[data-testid="hand-piece"]');
      await expect(handPieces).toHaveCount(6); // 7 - 1 (primeira peça jogada)
      
      // Verificar indicador de turno
      const turnIndicator = page.locator('[data-testid="turn-indicator"]');
      await expect(turnIndicator).toBeVisible();
    });

    test('should show correct game state for each player', async ({ browser }) => {
      const users = await authHelpers.createMultipleUsers(4);
      
      // Criar contextos para múltiplos jogadores
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
        browser.newContext(),
        browser.newContext()
      ]);
      
      const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
      
      // Login com cada usuário
      for (let i = 0; i < 4; i++) {
        await pages[i].goto('/');
        await new AuthHelpers(pages[i]).loginWithCredentials(users[i].email, users[i].password);
        await new GameHelpers(pages[i]).joinMatchmakingQueue();
      }
      
      // Aguardar criação do jogo
      await page.waitForTimeout(2000);
      
      // Verificar que todos os jogadores estão no mesmo jogo
      for (const playerPage of pages) {
        await expect(playerPage).toHaveURL(/\/game2\/[a-f0-9-]+/);
        await expect(playerPage.locator('[data-testid="game-board"]')).toBeVisible();
      }
      
      // Verificar que cada jogador vê suas próprias peças
      for (const playerPage of pages) {
        const handPieces = playerPage.locator('[data-testid="hand-piece"]');
        await expect(handPieces).toHaveCount(6);
      }
      
      // Cleanup
      await Promise.all(contexts.map(ctx => ctx.close()));
    });
  });

  test.describe('Valid Moves', () => {
    test('should allow valid piece placement', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      // Setup game
      const gameId = await gameHelpers.createTestGame(users.map(u => u.id));
      await page.goto(`/game2/${gameId}`);
      
      // Aguardar carregamento do jogo
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Verificar se é o turno do jogador
      const isMyTurn = await page.locator('[data-testid="my-turn-indicator"]').isVisible();
      
      if (isMyTurn) {
        // Selecionar uma peça jogável
        const playablePiece = page.locator('[data-testid="hand-piece"]:not([data-disabled="true"])').first();
        await expect(playablePiece).toBeVisible();
        
        // Jogar a peça
        await playablePiece.click();
        
        // Verificar feedback de sucesso
        await expect(page.locator('.sonner-toast')).toContainText(/sucesso|jogada/i);
        
        // Verificar que a peça foi removida da mão
        const handPiecesAfter = page.locator('[data-testid="hand-piece"]');
        await expect(handPiecesAfter).toHaveCount(5); // Uma a menos
        
        // Verificar que o turno passou
        await expect(page.locator('[data-testid="my-turn-indicator"]')).not.toBeVisible();
      }
    });

    test('should handle piece drag and drop', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      const gameId = await gameHelpers.createTestGame(users.map(u => u.id));
      await page.goto(`/game2/${gameId}`);
      
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      const isMyTurn = await page.locator('[data-testid="my-turn-indicator"]').isVisible();
      
      if (isMyTurn) {
        const playablePiece = page.locator('[data-testid="hand-piece"]:not([data-disabled="true"])').first();
        const gameBoard = page.locator('[data-testid="game-board"]');
        
        // Arrastar peça para o tabuleiro
        await playablePiece.dragTo(gameBoard);
        
        // Verificar que a jogada foi registrada
        await expect(page.locator('.sonner-toast')).toContainText(/sucesso|jogada/i);
      }
    });
  });

  test.describe('Invalid Moves', () => {
    test('should reject invalid piece placement', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      // Criar jogo com estado específico para testar jogada inválida
      const gameId = await databaseHelpers.createGameWithState({
        player_ids: users.map(u => u.id),
        board_state: {
          pieces: [{ piece: { l: 1, r: 2 } }],
          left_end: 1,
          right_end: 2
        },
        current_player: users[0].id,
        player_hands: {
          [users[0].id]: [{ l: 5, r: 6 }] // Peça que não conecta
        }
      });
      
      await page.goto(`/game2/${gameId}`);
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Tentar jogar peça inválida
      const invalidPiece = page.locator('[data-testid="hand-piece"]').first();
      await invalidPiece.click();
      
      // Verificar mensagem de erro
      await expect(page.locator('.sonner-toast')).toContainText(/inválida|erro/i);
      
      // Verificar que a peça permanece na mão
      await expect(invalidPiece).toBeVisible();
      
      // Verificar que ainda é o turno do jogador
      await expect(page.locator('[data-testid="my-turn-indicator"]')).toBeVisible();
    });

    test('should prevent moves when not player turn', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      // Criar jogo onde NÃO é o turno do jogador atual
      const gameId = await databaseHelpers.createGameWithState({
        player_ids: users.map(u => u.id),
        current_player: users[1].id, // Outro jogador
        player_hands: {
          [users[0].id]: [{ l: 1, r: 2 }]
        }
      });
      
      await page.goto(`/game2/${gameId}`);
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Verificar que não é o turno do jogador
      await expect(page.locator('[data-testid="my-turn-indicator"]')).not.toBeVisible();
      
      // Verificar que as peças estão desabilitadas
      const handPieces = page.locator('[data-testid="hand-piece"]');
      for (let i = 0; i < await handPieces.count(); i++) {
        await expect(handPieces.nth(i)).toHaveAttribute('data-disabled', 'true');
      }
      
      // Tentar jogar mesmo assim
      await handPieces.first().click({ force: true });
      
      // Verificar mensagem de erro
      await expect(page.locator('.sonner-toast')).toContainText(/não.*vez|turno/i);
    });
  });

  test.describe('Pass Turn', () => {
    test('should allow pass when no valid moves', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      // Criar estado onde o jogador não pode jogar
      const gameId = await databaseHelpers.createGameWithState({
        player_ids: users.map(u => u.id),
        board_state: {
          pieces: [{ piece: { l: 1, r: 2 } }],
          left_end: 1,
          right_end: 2
        },
        current_player: users[0].id,
        player_hands: {
          [users[0].id]: [{ l: 5, r: 6 }, { l: 3, r: 4 }] // Nenhuma conecta
        }
      });
      
      await page.goto(`/game2/${gameId}`);
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Verificar que o botão de passar está disponível
      const passButton = page.locator('[data-testid="pass-turn-button"]');
      await expect(passButton).toBeVisible();
      await expect(passButton).not.toBeDisabled();
      
      // Passar a vez
      await passButton.click();
      
      // Verificar feedback
      await expect(page.locator('.sonner-toast')).toContainText(/passou|turno/i);
      
      // Verificar que não é mais o turno do jogador
      await expect(page.locator('[data-testid="my-turn-indicator"]')).not.toBeVisible();
    });

    test('should prevent pass when valid moves exist', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      // Criar estado onde o jogador PODE jogar
      const gameId = await databaseHelpers.createGameWithState({
        player_ids: users.map(u => u.id),
        board_state: {
          pieces: [{ piece: { l: 1, r: 2 } }],
          left_end: 1,
          right_end: 2
        },
        current_player: users[0].id,
        player_hands: {
          [users[0].id]: [{ l: 2, r: 3 }] // Conecta no 2
        }
      });
      
      await page.goto(`/game2/${gameId}`);
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Tentar passar mesmo tendo jogada
      const passButton = page.locator('[data-testid="pass-turn-button"]');
      await passButton.click();
      
      // Verificar mensagem de erro
      await expect(page.locator('.sonner-toast')).toContainText(/jogáveis|não.*passar/i);
      
      // Verificar que ainda é o turno do jogador
      await expect(page.locator('[data-testid="my-turn-indicator"]')).toBeVisible();
    });
  });

  test.describe('Game Rules Validation', () => {
    test('should enforce domino connection rules', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      // Testar diferentes cenários de conexão
      const testCases = [
        {
          boardState: { left_end: 3, right_end: 5 },
          validPieces: [{ l: 3, r: 1 }, { l: 2, r: 5 }, { l: 5, r: 5 }],
          invalidPieces: [{ l: 1, r: 2 }, { l: 4, r: 6 }]
        }
      ];
      
      for (const testCase of testCases) {
        // Testar peças válidas
        for (const piece of testCase.validPieces) {
          const gameId = await databaseHelpers.createGameWithState({
            player_ids: users.map(u => u.id),
            board_state: {
              pieces: [{ piece: { l: 0, r: 0 } }],
              ...testCase.boardState
            },
            current_player: users[0].id,
            player_hands: {
              [users[0].id]: [piece]
            }
          });
          
          await page.goto(`/game2/${gameId}`);
          await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
          
          // Verificar que a peça é considerada jogável
          const handPiece = page.locator('[data-testid="hand-piece"]').first();
          await expect(handPiece).not.toHaveAttribute('data-disabled', 'true');
          
          await databaseHelpers.cleanupGame(gameId);
        }
        
        // Testar peças inválidas
        for (const piece of testCase.invalidPieces) {
          const gameId = await databaseHelpers.createGameWithState({
            player_ids: users.map(u => u.id),
            board_state: {
              pieces: [{ piece: { l: 0, r: 0 } }],
              ...testCase.boardState
            },
            current_player: users[0].id,
            player_hands: {
              [users[0].id]: [piece]
            }
          });
          
          await page.goto(`/game2/${gameId}`);
          await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
          
          // Verificar que a peça NÃO é jogável
          const handPiece = page.locator('[data-testid="hand-piece"]').first();
          await expect(handPiece).toHaveAttribute('data-disabled', 'true');
          
          await databaseHelpers.cleanupGame(gameId);
        }
      }
    });

    test('should handle double pieces correctly', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      // Testar peça dupla (carroça)
      const gameId = await databaseHelpers.createGameWithState({
        player_ids: users.map(u => u.id),
        board_state: {
          pieces: [{ piece: { l: 2, r: 2 } }], // Carroça de 2
          left_end: 2,
          right_end: 2
        },
        current_player: users[0].id,
        player_hands: {
          [users[0].id]: [{ l: 2, r: 5 }] // Conecta nos dois lados
        }
      });
      
      await page.goto(`/game2/${gameId}`);
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Verificar que a peça é jogável
      const handPiece = page.locator('[data-testid="hand-piece"]').first();
      await expect(handPiece).not.toHaveAttribute('data-disabled', 'true');
      
      // Jogar a peça
      await handPiece.click();
      
      // Verificar sucesso
      await expect(page.locator('.sonner-toast')).toContainText(/sucesso/i);
    });

    test('should update board ends correctly after moves', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      // Estado inicial conhecido
      const gameId = await databaseHelpers.createGameWithState({
        player_ids: users.map(u => u.id),
        board_state: {
          pieces: [{ piece: { l: 1, r: 2 } }],
          left_end: 1,
          right_end: 2
        },
        current_player: users[0].id,
        player_hands: {
          [users[0].id]: [{ l: 2, r: 5 }] // Conecta no lado direito
        }
      });
      
      await page.goto(`/game2/${gameId}`);
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Jogar a peça
      await page.locator('[data-testid="hand-piece"]').first().click();
      
      // Verificar que o board foi atualizado
      await page.waitForTimeout(1000);
      
      // Verificar no banco se os ends foram atualizados corretamente
      const gameState = await databaseHelpers.getGameState(gameId);
      expect(gameState.board_state.left_end).toBe(1); // Permanece
      expect(gameState.board_state.right_end).toBe(5); // Atualizado
    });
  });

  test.describe('Turn Management', () => {
    test('should cycle turns correctly', async ({ browser }) => {
      const users = await authHelpers.createMultipleUsers(4);
      
      // Criar contextos para 4 jogadores
      const contexts = await Promise.all(Array(4).fill(0).map(() => browser.newContext()));
      const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
      
      // Login com cada usuário
      for (let i = 0; i < 4; i++) {
        await pages[i].goto('/');
        await new AuthHelpers(pages[i]).loginWithCredentials(users[i].email, users[i].password);
      }
      
      // Criar jogo onde o primeiro jogador pode jogar
      const gameId = await databaseHelpers.createGameWithState({
        player_ids: users.map(u => u.id),
        current_player: users[0].id,
        player_hands: {
          [users[0].id]: [{ l: 1, r: 2 }],
          [users[1].id]: [{ l: 3, r: 4 }],
          [users[2].id]: [{ l: 5, r: 6 }],
          [users[3].id]: [{ l: 0, r: 1 }]
        }
      });
      
      // Todos navegam para o jogo
      for (const page of pages) {
        await page.goto(`/game2/${gameId}`);
        await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      }
      
      // Verificar que apenas o primeiro jogador pode jogar
      await expect(pages[0].locator('[data-testid="my-turn-indicator"]')).toBeVisible();
      for (let i = 1; i < 4; i++) {
        await expect(pages[i].locator('[data-testid="my-turn-indicator"]')).not.toBeVisible();
      }
      
      // Primeiro jogador joga ou passa
      const hasPlayablePiece = await pages[0].locator('[data-testid="hand-piece"]:not([data-disabled="true"])').count() > 0;
      
      if (hasPlayablePiece) {
        await pages[0].locator('[data-testid="hand-piece"]:not([data-disabled="true"])').first().click();
      } else {
        await pages[0].locator('[data-testid="pass-turn-button"]').click();
      }
      
      // Aguardar mudança de turno
      await pages[0].waitForTimeout(2000);
      
      // Verificar que o turno passou para o próximo jogador
      await expect(pages[0].locator('[data-testid="my-turn-indicator"]')).not.toBeVisible();
      await expect(pages[1].locator('[data-testid="my-turn-indicator"]')).toBeVisible();
      
      // Cleanup
      await Promise.all(contexts.map(ctx => ctx.close()));
    });

    test('should handle timeout correctly', async ({ page }) => {
      const users = await authHelpers.createMultipleUsers(4);
      await authHelpers.loginWithCredentials(users[0].email, users[0].password);
      
      // Criar jogo com timeout curto para teste
      const gameId = await databaseHelpers.createGameWithState({
        player_ids: users.map(u => u.id),
        current_player: users[0].id,
        player_hands: {
          [users[0].id]: [{ l: 1, r: 2 }]
        },
        turn_timeout: 5000 // 5 segundos para teste
      });
      
      await page.goto(`/game2/${gameId}`);
      await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
      
      // Verificar que é o turno do jogador
      await expect(page.locator('[data-testid="my-turn-indicator"]')).toBeVisible();
      
      // Aguardar timer aparecer
      const timer = page.locator('[data-testid="turn-timer"]');
      await expect(timer).toBeVisible();
      
      // Aguardar timeout (mais alguns segundos para garantir)
      await page.waitForTimeout(8000);
      
      // Verificar que uma ação automática foi tomada
      await expect(page.locator('.sonner-toast')).toContainText(/automático|timeout/i);
      
      // Verificar que não é mais o turno do jogador
      await expect(page.locator('[data-testid="my-turn-indicator"]')).not.toBeVisible();
    });
  });
});
