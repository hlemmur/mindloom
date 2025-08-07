import { query } from '@/lib/db';
import { DataSource, ApiResponse } from '@/lib/types';
import { encryptApiKey, decryptApiKey } from '@/lib/encryption';

// Get data sources for a user
export async function getDataSources(userId: string): Promise<ApiResponse<DataSource[]>> {
  try {
    const result = await query(
      'SELECT id, user_id, source_type, source_name, last_sync_at, sync_status, created_at, updated_at FROM data_sources WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return {
      success: true,
      data: result.rows,
    };
  } catch (error) {
    console.error('Error fetching data sources:', error);
    return {
      success: false,
      error: 'Failed to fetch data sources',
    };
  }
}

// Create a new data source
export async function createDataSource(
  userId: string,
  sourceType: 'chatgpt' | 'notes' | 'email' | 'health',
  sourceName?: string,
  apiKey?: string
): Promise<ApiResponse<DataSource>> {
  try {
    const encryptedApiKey = apiKey ? encryptApiKey(apiKey) : null;

    const result = await query(
      `INSERT INTO data_sources (user_id, source_type, source_name, api_key_encrypted) 
       VALUES ($1, $2, $3, $4) RETURNING 
       id, user_id, source_type, source_name, last_sync_at, sync_status, created_at, updated_at`,
      [userId, sourceType, sourceName || null, encryptedApiKey]
    );

    return {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    console.error('Error creating data source:', error);
    return {
      success: false,
      error: 'Failed to create data source',
    };
  }
}

// Update data source sync status
export async function updateDataSourceSyncStatus(
  userId: string,
  sourceId: string,
  status: 'idle' | 'syncing' | 'error' | 'completed',
  lastSyncAt?: Date
): Promise<ApiResponse<DataSource>> {
  try {
    const result = await query(
      `UPDATE data_sources 
       SET sync_status = $1, last_sync_at = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, user_id, source_type, source_name, last_sync_at, sync_status, created_at, updated_at`,
      [status, lastSyncAt || new Date(), sourceId, userId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Data source not found',
      };
    }

    return {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    console.error('Error updating data source:', error);
    return {
      success: false,
      error: 'Failed to update data source',
    };
  }
}

// Get decrypted API key for a data source
export async function getDataSourceApiKey(
  userId: string,
  sourceId: string
): Promise<ApiResponse<string>> {
  try {
    const result = await query(
      'SELECT api_key_encrypted FROM data_sources WHERE id = $1 AND user_id = $2',
      [sourceId, userId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Data source not found',
      };
    }

    const encryptedKey = result.rows[0].api_key_encrypted;
    if (!encryptedKey) {
      return {
        success: false,
        error: 'No API key stored for this data source',
      };
    }

    const apiKey = decryptApiKey(encryptedKey);

    return {
      success: true,
      data: apiKey,
    };
  } catch (error) {
    console.error('Error getting API key:', error);
    return {
      success: false,
      error: 'Failed to retrieve API key',
    };
  }
}

// Delete a data source
export async function deleteDataSource(
  userId: string,
  sourceId: string
): Promise<ApiResponse<void>> {
  try {
    const result = await query(
      'DELETE FROM data_sources WHERE id = $1 AND user_id = $2',
      [sourceId, userId]
    );

    if (result.rowCount === 0) {
      return {
        success: false,
        error: 'Data source not found',
      };
    }

    return {
      success: true,
      message: 'Data source deleted successfully',
    };
  } catch (error) {
    console.error('Error deleting data source:', error);
    return {
      success: false,
      error: 'Failed to delete data source',
    };
  }
}